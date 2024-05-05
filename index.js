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
  res.send({
    normal: await GetRecipes(req.body),
    topcomplex: await GetRecipes({ ...req.body, byComplexity: true }),
  });
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

// maybe break apart those  and request only the recipe
// and after the page loads , then start to fetch for each recipe
// those aditional properties so user does not feel lag
// currently like 800 ms
function PackageResponse({ records }) {
  let res = records.map((record) => {
    // 770 ms -(one object destructuring x150)> 660ms
    // too much delay
    // neo4j/browser takes 70 ms
    var _temp = record.get("r");
    _temp.author = record.get("author");
    _temp.dietTypes = record.get("dietTypes");
    // lists
    _temp.ingredients = record.get("ingredients");
    _temp.collections = record.get("collections");
    _temp.keywords = record.get("keywords");
    return _temp;
  });

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
    authorName = "",
    pageNr,
    querry = "",
    ingredientsQuerry = [],
    sortProperty = {},
    trimRecipeName = false,
    byComplexity = false,
  } = opts;
  console.log(ingredientsQuerry);
  var iq = ingredientsQuerry;
  iq = iq.map((it) => `"${it}"`).join(", ");

  if (pageNr < 0) return [];

  console.log(sortProperty);

  var filterByIngredients = "";
  if (iq.length)
    filterByIngredients = `
MATCH (r)-[:CONTAINS_INGREDIENT]->(i:Ingredient)
WITH r, collect(i.name) as ingredients
WHERE ALL (
    check_ingr IN [${iq}]
    WHERE ANY(
        ingr in ingredients WHERE ingr = check_ingr
    )
)`;

  var sort = `
MATCH (r)-[cc:CONTAINS_INGREDIENT]->(i:Ingredient)
WITH r, r.name as recipe_name,  count(cc) as ingr_count, reverse(r.skillLevel) as skillLevel
ORDER BY `;

  sortProperty.order.forEach((key, index) => {
    if (index > 0) sort += ",";

    var direction = sortProperty[key];
    if (key == "skillLevel") {
      if (direction == "ASC") direction = "DESC";
      else if (direction == "DESC") direction = "ASC";
    }
    sort += key + " " + direction;
  });

  // Get the name of all 42 year-olds
  // search is case sensitive
  // if querry is "" it seems that cypher ignores it :)))
  // querry seems to not work as expected
  // pottentially trim cuz some start with space (make a toggle or something in frontend)
  return await QuerryNeo4jDB(`
MATCH (r:Recipe)${
    authorName ? `<-[:WROTE]-(:Author {name: "${authorName}"})` : ""
  }
${filterByIngredients}
${querry ? `WITH r\nWHERE r.name CONTAINS "${querry}"` : ""}
${sort} 
WITH r SKIP ${pageNr * PAGE_SIZE} LIMIT ${PAGE_SIZE}
OPTIONAL MATCH (r)-[]-(auth:Author)
OPTIONAL MATCH (r)-[]-(dt:DietType)
WITH r, auth, collect(dt.name) as dietTypes
OPTIONAL MATCH (r)-[]-(c:Collection)
WITH r, auth, dietTypes, collect(c.name) as collections
OPTIONAL MATCH (r)-[]-(i:Ingredient)
WITH r, auth, dietTypes, collections, collect(i.name) as ingredients
OPTIONAL MATCH (r)-[]-(k:Keyword)
WITH r, auth, dietTypes, collections, ingredients,collect(k.name) as keywords
WITH r, auth.name as author, dietTypes, collections, ingredients, keywords
${
  byComplexity
    ? `
WITH *,  reverse(r.skillLevel) as trick, size(ingredients) as ingCount  ORDER BY trick ASC, ingCount DESC, r.preparationTime DESC , r.cookingTime DESC, r.name ASC
LIMIT 5
`
    : ""
}  
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
