#!/usr/bin/env zx

/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { promises: fs } = require("fs");

async function getPackagesNames(files) {
  const names = [];
  for (const file of files) {
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    names.push(data.name);
  }
  return names;
}

async function createChangeset(fileName, commitMessage, packages) {
  const pkgs = packages.map((pkg) => `'${pkg}': patch`).join("\n");
  const message = commitMessage.stdout.replace(
    /(b|B)ump ([a-z-]+)/,
    "Bump `$2`"
  );
  const body = `---\n${pkgs}\n---\n\n${message}`;
  await fs.writeFile(fileName, body);
}

async function main() {
  const branch = await $`git branch --show-current`;

  if (!branch.stdout.startsWith("dependabot/")) {
    console.log("Not a dependabot branch");
    return;
  }

  const diffFiles = await $`git diff --name-only HEAD~1`;
  const files = diffFiles.stdout
    .split("\n")
    .filter((file) => file !== "package.json") // skip root package.json
    .filter((file) => file.includes("package.json"));

  if (!files.length) {
    console.log("no package.json changes, skipping");
    return;
  }

  const commitMessage = await $`git show --pretty=format:%s -s HEAD`;
  const packageNames = await getPackagesNames(files);
  const shortHash = await $`git rev-parse --short HEAD`;
  const fileName = `.changeset/dependabot-${shortHash.stdout}.md`;
  await createChangeset(fileName, commitMessage, packageNames);
  await $`git config --global user.email "noreply@backstage.io"`;
  await $`git config --global user.name "Github changeset workflow"`;
  await $`git add ${fileName}`;
  await $`git commit -s -m "dependabot: add changeset"`;
  await $`git push`;
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
