const fetch = require("node-fetch");
const crypto = require("crypto");
const fs = require("fs");
const process = require("process");

const main = async ({ update } = { update: false }) => {
  const html = await fetch(
    "https://media.interieur.gouv.fr/deplacement-covid-19/"
  ).then((res) => res.text());
  const digest = crypto.createHash("md5").update(html).digest("hex");
  console.log(html);
  if (update) {
    fs.writeFileSync(".stored_digest", digest);
  } else {
    const previous_digest = fs.readFileSync(".stored_digest").toString();
    if (previous_digest !== digest) {
      console.error(`
        Computer digest '${digest}' did not match stored one '${previous_digest}' !
        You should check what changed !
        Then run 'npm run monitor:update' to create a new .stored_digest, commit and push it 👌
        `);
      process.exit(1);
    }
  }
};

if (process.argv.length === 3 && process.argv[2] === "update") {
  main({ update: true });
} else if (process.argv.length === 3 && process.argv[2] === "check") {
  main();
} else {
  console.log("No idea what you meant mate :x");
}
