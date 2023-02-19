import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type Issue = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][0];
export type Label = RestEndpointMethodTypes["issues"]["createLabel"]["parameters"];
export type Milestone = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][0]["milestone"];
