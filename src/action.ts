import * as core from "@actions/core";
import * as github from "@actions/github";

const run = async () => {
  // glob all the file
  const TARGET_FOLDER = core.getInput("TARGET_FOLDER");
  const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
  // const GHOST_BASE_API_URL = core.getInput("GHOST_BASE_API_URL");
  // const GHOST_CONTENT_API_TOKEN = core.getInput("GHOST_CONTENT_API_TOKEN");
  // const GHOST_ADMIN_API_TOKEN = core.getInput("GHOST_ADMIN_API_TOKEN");

  if (!TARGET_FOLDER) {
    core.setFailed(
      `Target folder must be provided, don't need to add any slash`
    );
  }

  // Debug log the payload
  core.debug(`Payload keys: ${Object.keys(github.context.payload)}`);

  // Get event name
  const eventName = github.context.eventName;

  core.info(eventName);

  // Define the base and head commits to be extracted from the payload.
  let base: string | undefined;
  let head: string | undefined;

  switch (eventName) {
    case "pull_request":
      base = github.context.payload.pull_request?.base?.sha;
      head = github.context.payload.pull_request?.head?.sha;
      break;
    case "push":
      base = github.context.payload.before;
      head = github.context.payload.after;
      break;
    default:
      core.setFailed(
        `This action only supports pull requests and pushes, ${github.context.eventName} events are not supported. ` +
          "Please submit an issue on this action's GitHub repo if you believe this in correct."
      );
  }

  // Log the base and head commits
  core.info(`Base commit: ${base}`);
  core.info(`Head commit: ${head}`);

  // Ensure that the base and head properties are set on the payload.
  if (!base || !head) {
    core.setFailed(
      `The base and head commits are missing from the payload for this ${github.context.eventName} event. ` +
        "Please submit an issue on this action's GitHub repo."
    );

    // To satisfy TypeScript, even though this is unreachable.
    base = "";
    head = "";
  }

  // Use GitHub's compare two commits API.
  // https://developer.github.com/v3/repos/commits/#compare-two-commits

  const client = github.getOctokit(GITHUB_TOKEN);

  const response = await client.rest.repos.compareCommits({
    base,
    head,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  });

  // Ensure that the request was successful.
  if (response.status !== 200) {
    core.setFailed(
      `The GitHub API for comparing the base and head commits for this ${github.context.eventName} event returned ${response.status}, expected 200. ` +
        "Please submit an issue on this action's GitHub repo."
    );
  }

  // Ensure that the head commit is ahead of the base commit.
  if (response.data.status !== "ahead") {
    core.setFailed(
      `The head commit for this ${github.context.eventName} event is not ahead of the base commit. ` +
        "Please submit an issue on this action's GitHub repo."
    );
  }

  // Get the changed files from the response payload.
  const files = response.data.files;
  let modified = [];

  if (!files) {
    core.setFailed(
      `There is no difference between the head and base commit of this ${github.context.eventName} event.` +
        "Please submit an issue on this action's GitHub repo."
    );
    return;
  }

  for (const file of files) {
    const pathList = file.filename.split("/");
    core.info(
      `${pathList.toString()}, ${pathList.includes(
        TARGET_FOLDER
      )}, ${TARGET_FOLDER}, ${file.status}`
    );
    if (file.status === "modified" && pathList.includes(TARGET_FOLDER)) {
      modified.push(file);
      core.info(`Changed file: ${file.filename}`);
    }
  }
};

run();
