workflow "Build, Test, and Publish" {
  on = "push"
  resolves = [
    "Publish",
    "Lint",
    "npm audit",
  ]
}

action "Install" {
  uses = "actions/npm@master"
  args = "install"
}

action "Test" {
  uses = "actions/npm@master"
  args = "run cover"
  needs = ["Lint"]
}

action "Only if new TAG" {
  uses = "actions/bin/filter@master"
  needs = ["Test"]
  args = "tag"
}

action "Publish" {
  uses = "actions/npm@master"
  args = "publish --access public"
  secrets = ["NPM_AUTH_TOKEN"]
  needs = ["Only if new TAG"]
}

action "Lint" {
  uses = "actions/npm@master"
  needs = ["npm audit"]
  args = "run lint"
}

action "npm audit" {
  uses = "actions/npm@master"
  needs = ["Install"]
  args = "audit"
}
