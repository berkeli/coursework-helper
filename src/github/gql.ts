import projectFields from "./projectFields.json";

type Field = {
  name: string;
  dataType: "DATE" | "NUMBER" | "SINGLE_SELECT";
  singleSelectOptions?: {
    name: string;
    color: string;
    description: string;
  }[];
};

function fieldToGql(field: Field) {
  return ` createProjectV2Field(input: { 
        name: "${field.name}",
        projectId: $projectId, 
        dataType: ${field.dataType},
        singleSelectOptions: [${
          field.singleSelectOptions?.map(
            (option) => `{
                name: "${option.name}", 
                color: ${option.color}, 
                description: "${option.description}"
            }`
          ) || []
        }]
    }) {
        projectV2Field {
            ... on ${field.dataType === "SINGLE_SELECT" ? "ProjectV2SingleSelectField" : "ProjectV2Field"} {
              id
          }
        }
      }
`;
}

export const createProject = `
mutation CreateProject($title: String = "CYF Coursework", $ownerId: ID!, $repositoryId: ID!) {
    createProjectV2(input: { title: $title, ownerId: $ownerId, repositoryId: $repositoryId }) {
      projectV2 {
        id
      }
    }
  }  
`;

export const makeProjectPublic = `
mutation UpdateProject($projectId: ID!) {
    createProjectV2(input: { id: $projectId, public: true }) {}
  }
`;

let createProjectFieldsQ = `mutation createProjectV2Fields($projectId: ID!) {
`;

projectFields.forEach((field, id) => {
  createProjectFieldsQ += `
        field_${id}: ${fieldToGql(field as Field)}
    `;
});

console.log(createProjectFieldsQ + "}");

export const createProjectFields = createProjectFieldsQ;
