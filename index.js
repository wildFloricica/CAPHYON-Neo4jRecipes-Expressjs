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
    `MATCH (r:Recipe)-[:CONTAINS_INGREDIENT]->(i:Ingredient) 
RETURN r, Count(i) as countt
ORDER BY r.name
SKIP ${page_size * page_nr}
LIMIT ${page_size}`,
    {},
    { database: "neo4j" }
  );
  return records.map((record) => {
    var _temp = record.get("r");
    _temp.properties.ingredients = record.get("countt");
    return _temp;
  });
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
