const express = require("express");
const cors = require("cors");
const neo4j = require("neo4j-driver");
require("dotenv").config();
let driver;

// issues
/*
  filtering by ingredients is bad
  filtering by recipe.name is kinda ok
  sorting by recipe.name may require a trim on strings
*/

const PAGE_SIZE = 20;
// test all edge cases

const app = express();

app.use(cors());
app.use(express.static("public"));
app.use(express.json());

app.post("/api/recipes", async (req, res) => {
  res.send(await GetRecipes(req.body));
});
app.get("/api/all-ingredients", async (req, res) =>
  res.send(await GetAllIngredients())
);
app.get("/", (req, res) => {
  res.redirect("/home.html");
});

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

function PackageResponse({ records }) {
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

async function QuerryNeo4jDB(querry) {
  console.log(querry);
  console.log();
  console.log();
  console.log();
  var opts = { database: "neo4j" };
  return PackageResponse(await driver.executeQuery(querry, {}, opts));
}

async function GetAllIngredients() {
  const response = await driver.executeQuery(
    `MATCH (i:Ingredient)
RETURN i.name as ingredient`
  );
  const result = response.records.map((record) => record.get("ingredient"));
  return result;
}

async function GetRecipes(opts) {
  // prevent cypher injection in the future
  var {
    author_name = "",
    page_nr,
    querry = "",
    ingredientsQuerry = [],
    sortProperty = {},
    trimRecipeName = false,
  } = opts;
  console.log(ingredientsQuerry);
  var iq = ingredientsQuerry;
  iq = iq.map((it) => `"${it}"`).join(", ");

  if (page_nr < 0) return [];

  console.log(sortProperty);

  // imporve WHERE for ingredients cuz it is praf now
  var filterByIngredients = "";
  if (iq.length)
    filterByIngredients = `
  MATCH (r)-[:CONTAINS_INGREDIENT]->(i:Ingredient)
    WHERE any(ingr_name IN [${iq}] WHERE  ingr_name =i.name)\n`;

  var sort = "";
  if (sortProperty.property == "name") sort = "WITH r ORDER BY r.name ASC";
  if (sortProperty.property == "skillLevel") {
    var type = "ASC";
    if (sortProperty.type == "ASC") type = "DESC";

    sort = `WITH r,  reverse(r.skillLevel) as trick ORDER BY trick ${type}`;
  }
  if (sortProperty.property == "ingr_count")
    sort = `
    MATCH (r)-[cc:CONTAINS_INGREDIENT]->(i:Ingredient)
    WITH r, count(cc) as cco ORDER BY cco ${sortProperty.type}`;

  // Get the name of all 42 year-olds
  // search is case sensitive
  // if querry is "" it seems that cypher ignores it :)))
  // querry seems to not work as expected
  // pottentially trim cuz some start with space (make a toggle or something in frontend)
  return await QuerryNeo4jDB(`
  MATCH (r:Recipe)${
    author_name ? `<-[:WROTE]-(:Author {name: "${author_name}"})` : ""
  }
${filterByIngredients}
${querry ? `WITH r\nWHERE r.name CONTAINS "${querry}"` : ""}
${sort} 
WITH r SKIP ${page_nr * PAGE_SIZE} LIMIT ${PAGE_SIZE}
MATCH (auth: Author)-[:WROTE]->(r)-[:CONTAINS_INGREDIENT]->(i:Ingredient)
RETURN *`);
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
    await GetAllIngredients();
  } catch (err) {
    console.log(`Connection error\n${err}\nCause: ${err.cause}`);
  }
})();
