const express = require("express");
const cors = require("cors");
const neo4j = require("neo4j-driver");
require("dotenv").config();
let driver;

// test all edge cases

const app = express();

app.use(cors());
app.use(express.static("public"));

app.get("/api/recipes_page=:page", async (req, res) => {
  res.send(await GetRecipesByPage(req.params.page));
});

app.get("/", (req, res) => {
  res.redirect("/home.html");
});

async function GetRecipesByPage(page_nr, page_size = 20) {
  if (page_nr < 0) return [];
  // Get the name of all 42 year-olds
  const { records, summary, keys } = await driver.executeQuery(
    `
MATCH (auth: Author)-[:WROTE]->(r:Recipe)
WITH r, auth SKIP ${page_size * page_nr} LIMIT ${page_size}
MATCH (r)-[:CONTAINS_INGREDIENT]->(i:Ingredient)
RETURN *
ORDER BY r.name`,
    {},
    { database: "neo4j" }
  );

  let res = [];
  records.forEach((record) => {
    var _temp = record.get("r");
    // if it has different id it means it is another node
    if (_temp.elementId != res.at(-1)?.elementId) res.push({ ..._temp });

    const r = res.at(-1);
    if (r.author == undefined) r.author = record.get("auth");
    if (r.ingredients == undefined) r.ingredients = [];
    r.ingredients.push(record.get("i"));
  });
  console.log(res);
  return res;
}

(async () => {
  // URI examples: 'neo4j://localhost', 'neo4j+s://xxx.databases.neo4j.io'
  try {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );
    const serverInfo = await driver.getServerInfo();
    console.log("Connection established");
    console.log(serverInfo);
    // start server
    app.listen(3001, () => console.log("asdasd"));
  } catch (err) {
    console.log(`Connection error\n${err}\nCause: ${err.cause}`);
  }
})();
