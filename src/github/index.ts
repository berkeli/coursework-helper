import { Octokit } from "octokit";
import { RequestError } from "@octokit/types";
import config from "../config";
import { Milestone } from "./types";
import _ from "lodash";

class Github {
  o: Octokit;
  owner = "";
  ownerId = "";
  defaultRepo: string;
  repoId = "";
  defaultOwner: string;
  milestoneMap: {
    [key: string]: number;
  } = {};

  constructor(token: string) {
    this.o = new Octokit({
      auth: token,
    });

    this.defaultOwner = config.defaultOwner;
    this.defaultRepo = config.defaultRepo;
    this.o.rest.users
      .getAuthenticated()
      .then((resp) => {
        this.owner = resp.data.login;
        this.ownerId = resp.data.node_id;
      })
      .catch((error) => {
        throw new Error(error);
      });
  }

  createDefaultRepo = async (): Promise<boolean> => {
    try {
      const { data: repo } = await this.o.rest.repos.createForAuthenticatedUser({
        name: config.defaultRepo,
        has_issues: true,
        private: false,
        has_projects: true,
      });

      this.repoId = repo.node_id;

      // remove default labels
      const data = await this.o.paginate(this.o.rest.issues.listLabelsForRepo, {
        owner: this.owner,
        repo: config.defaultRepo,
        per_page: 100,
      });

      for (const label of data) {
        await this.o.rest.issues.deleteLabel({
          owner: this.owner,
          repo: config.defaultRepo,
          name: label.name,
        });
      }

      return true;
    } catch (error) {
      const err = error as RequestError;
      // if repo already exists, do nothing
      if (err.status !== 422) {
        throw new Error("Error creating default repo");
      }

      return true;
    }
  };

  ensureRepoExists = async (): Promise<boolean> => {
    try {
      // get user's repo
      const { data } = await this.o.rest.repos.get({
        owner: this.owner,
        repo: config.defaultRepo,
      });

      // if repo doesn't have issues, enable them
      // if repo is private, make it public
      // if repo doesn't have projects, enable them
      if (!data.has_issues || data.private || !data.has_projects) {
        await this.o.rest.repos.update({
          owner: this.owner,
          repo: this.defaultRepo,
          has_issues: true,
          private: false,
          has_projects: true,
        });
      }

      this.repoId = data.node_id;

      return true;
    } catch (error) {
      const err = error as RequestError;
      // if repo doesn't exist, create it
      if (err.status === 404) {
        await this.createDefaultRepo();
        return true;
      } else {
        this.o.log.error(JSON.stringify(err));
        throw new Error("Error ensuring default repo exists");
      }
    }
  };

  ensureMilestonesExist = async (repo: string): Promise<boolean> => {
    try {
      const userMilestones = await this.o.paginate(this.o.rest.issues.listMilestones, {
        owner: this.owner,
        repo: config.defaultRepo,
      });

      // create hash map of milestones
      // because id is not guaranteed to be the same for everyone

      userMilestones.forEach((milestone) => {
        if (milestone?.title) {
          this.milestoneMap[milestone.title] = milestone.number;
        }
      });

      const newMilestones: Milestone[] = [];

      // create labels and milestones that don't exist
      const repoMilestones = await this.o.paginate(this.o.rest.issues.listMilestones, {
        state: "all",
        owner: this.defaultOwner,
        repo,
      });

      repoMilestones.forEach((milestone) => {
        if (milestone?.title) {
          if (!this.milestoneMap[milestone.title]) {
            newMilestones.push(milestone);
          }
        }
      });

      const uniques = _.uniqWith<Milestone>(newMilestones, _.isEqual);

      for (const milestone of uniques) {
        if (!milestone || !milestone.title) {
          continue;
        }
        try {
          const { data } = await this.o.rest.issues.createMilestone({
            owner: this.owner,
            repo: this.defaultRepo,
            title: milestone.title as string,
            description: milestone.description as string,
            state: "open",
            due_on: milestone.due_on || undefined,
          });

          this.milestoneMap[milestone.title] = data.number;
        } catch (error) {
          this.o.log.error("Error creating milestone", error as RequestError);
        }
      }

      return true;
    } catch (error) {
      this.o.log.error(JSON.stringify(error));
      return false;
    }
  };

  cloneAllFromRepo = async (repo: string, allowDuplicates = false): Promise<{ issues: number; failed: number }> => {
    const issues = await this.o.paginate(this.o.rest.issues.listForRepo, {
      owner: this.defaultOwner,
      repo,
      per_page: 100,
    });

    if (!issues || issues.length === 0) {
      throw new Error("No issues found");
    }

    let ok = await this.ensureRepoExists();
    if (!ok) {
      throw new Error("Error ensuring repo exists");
    }

    ok = await this.ensureMilestonesExist(repo);

    if (!ok) {
      throw new Error("Error ensuring milestones exist");
    }

    // get all issues from user's repo to check for duplicates
    const userIssueMap: { [key: string]: boolean } = {};
    if (!allowDuplicates) {
      const userIssues = await this.o.paginate(this.o.rest.issues.listForRepo, {
        owner: this.owner,
        repo: this.defaultRepo,
        per_page: 100,
      });

      userIssues.forEach((issue) => {
        if (issue?.title) {
          userIssueMap[issue.title] = true;
        }
      });
    }
    let failed = 0;

    for (const issue of issues) {
      if (!issue.body || userIssueMap[issue.title]) {
        continue;
      }

      this.o.rest.issues
        .create({
          owner: this.owner,
          assignees: [this.owner],
          repo: this.defaultRepo,
          title: issue.title,
          body: issue.body,
          milestones: issue.milestone ? [this.milestoneMap[issue.milestone.title]] : [],
          labels: issue.labels,
        })
        .catch((error) => {
          failed++;
          this.o.log.error("Error creating issue", error as RequestError);
        });
    }

    return {
      issues: issues.length,
      failed,
    };
  };

  cloneSingleIssue = async (repo: string, issueNumber: number): Promise<boolean> => {
    try {
      const { data } = await this.o.rest.issues.get({
        owner: this.defaultOwner,
        repo,
        issue_number: issueNumber,
      });

      if (!data.body) {
        throw new Error("No issue body found");
      }

      let ok = await this.ensureRepoExists();
      if (!ok) {
        throw new Error("Error ensuring repo exists");
      }

      ok = await this.ensureMilestonesExist(repo);

      if (!ok) {
        throw new Error("Error ensuring milestones exist");
      }

      await this.o.rest.issues.create({
        owner: this.owner,
        assignees: [this.owner],
        repo: this.defaultRepo,
        title: data.title,
        body: data.body,
        milestones: data.milestone ? [this.milestoneMap[data.milestone.title]] : [],
        labels: data.labels,
      });

      return true;
    } catch (error) {
      this.o.log.error("Couldn't clone issue", error as RequestError);
      return false;
    }
  };

  createProject = async (name: string = "CYF Coursework", body: string): Promise<boolean> => {
    try {
      await this.o.graphql();

      return true;
    } catch (error) {
      this.o.log.error("Error creating project", error as RequestError);
      return false;
    }
  };
}

export default Github;
