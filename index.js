const express = require("express");
const cors = require("cors");
const neo4j = require("neo4j-driver");
require("dotenv").config();
let driver;

// test all edge cases

const app = express();

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

app.post("/api/recipes", async (req, res) => {
  res.send(await GetRecipes(req.body));
});
app.get("/", (req, res) => {
  res.redirect("/home.html");
});

// mandatory
async function GetAplhOrderedRecipes(page = 0, page_size = 20) {}
async function GetAlphAndByName() {}
// pagination also for this? not sure
async function FilterByIngredientsNames() {}
async function GetAllRecipesOfAuthor(author) {}

// optional
async function FilterByIngredientsCount() {}
async function FilterBySkillLevel() {}
async function GetCollectionTypesOfRecipe(recipe_id) {}
async function GetKeywordsTypesOfRecipe(recipe_id) {}
async function GetDietTypesOfRecipe(recipe_id) {}
// in percentages also, or label
async function Get5MostSimilarRecipesOfRecipe() {}
// i assume it is for page
async function Get5MostCommonIngredientsForPage() {}
async function Get5MostProlificActorsForPage() {}
async function Get5MostComplexRecipesForPage() {}

async function GetRecipes(opts) {
  console.log("hi");
  // prevent cypher injection in the future
  var { page_nr, page_size = 20, querry = "", ingredientsQuerry = "" } = opts;

  ingredientsQuerry = ingredientsQuerry
    .split(" ")
    .map((it) => it.trim())
    .filter((it) => it);

  if (page_nr < 0) return [];
  // Get the name of all 42 year-olds

  const skip = page_nr * page_size;
  const limit = page_size;

  // if querry is "" it seems that cypher ignores it :)))
  // querry seems to not work as expected
  // pottentially trim cuz some start with space (make a toggle or something in frontend)
  const { records, summary, keys } = await driver.executeQuery(
    `
MATCH (r:Recipe)
WITH r ORDER BY r.name
Where r.name CONTAINS "${querry}"
WITH r SKIP ${skip} LIMIT ${limit}
MATCH (auth: Author)-[:WROTE]->(r)  
MATCH (r)-[:CONTAINS_INGREDIENT]->(i:Ingredient)
RETURN *`,
    {},
    { database: "neo4j" }
  );

  let res = [];
  records.forEach((record) => {
    // 770 ms -(one object destructuring x150)> 660ms
    // too much delay
    // neo4j/browser takes 70 ms
    var _temp = record.get("r");

    // if it has different id it means it is another node
    if (_temp.elementId != res.at(-1)?.elementId) res.push(_temp);

    const r = res.at(-1);
    if (r.author == undefined) r.author = record.get("auth");
    if (r.ingredients == undefined) r.ingredients = [];
    r.ingredients.push(record.get("i"));
  });
  console.log(records.length);
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
