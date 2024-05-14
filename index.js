const express = require("express");
const cors = require("cors");
const neo4j = require("neo4j-driver");
require("dotenv").config();
let driver;
const fs = require("fs");

//
//
//
//
//
//
// readme.ahhhh
//
// am lasat cypher injection pe final si nu am mai apucat sa-l fac 🥲🥲🥲
// si optimizari la querryuri se mai puteau face destule
//
//
//
// .  🌸🌸  🌸🌸
// .🌸🌸🌸🌸🌸🌸
// .🌸🌸🌸🌸🌸🌸
// .🌸🌸🌸🌸🌸🌸
// .   🌸🌸🌸🌸
// .     🌸🌸
//
//
//
//
//

// issues
/*
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

app.post("/api/similar", async (req, res) => {
  res.send(
    await QuerryNeo4jDB(
      `
// get recipe
MATCH (r:Recipe)
WHERE r.name CONTAINS "${req.body.recipeName}"
WITH r LIMIT 1
// get all data for recipe
OPTIONAL MATCH (r)-[]-(auth:Author)
WITH r, auth.name as an
OPTIONAL MATCH (r)-[]-(dt:DietType)
WITH r, an, collect(dt.name) as dts
OPTIONAL MATCH (r)-[]-(c:Collection)
WITH r, an, dts, collect(c.name) as cs
OPTIONAL MATCH (r)-[]-(i:Ingredient)
WITH r, an, dts, cs, collect(i.name) as iis
OPTIONAL MATCH (r)-[]-(k:Keyword)
WITH r, an, dts, cs, iis, collect(k.name) as ks
WITH r, an, dts, cs, iis, ks



// get all data for all recipes
MATCH (dr:Recipe)
WHERE  NOT( dr.name CONTAINS "${req.body.recipeName}")
OPTIONAL MATCH (dr)-[]-(auth:Author)
WITH r, an, dts, cs, iis, ks, dr, auth.name as dan
OPTIONAL MATCH (dr)-[]-(dt:DietType)
WITH r, an, dts, cs, iis, ks, dr, dan, collect(dt.name) as ddts
OPTIONAL MATCH (dr)-[]-(c:Collection)
WITH r, an, dts, cs, iis, ks, dr, dan, ddts, collect(c.name) as dcs
OPTIONAL MATCH (dr)-[]-(i:Ingredient)
WITH r, an, dts, cs, iis, ks, dr, dan, ddts, dcs, collect(i.name) as diis
OPTIONAL MATCH (dr)-[]-(k:Keyword)
WITH r, an, dts, cs, iis, ks, dr, dan, ddts, dcs, diis, collect(k.name) as dks
WITH r, an, dts, cs, iis, ks, dr, dan, ddts, dcs, diis, dks


WITH r, an, dts, cs, iis, ks, dr, dan, ddts, dcs, diis, dks,
    apoc.coll.intersection(dts, ddts) as fdts,
    apoc.coll.intersection(cs, dcs) as fcs,
    apoc.coll.intersection(iis, diis) as fiis,
    apoc.coll.intersection(ks, dks) as fks

ORDER BY size(fiis) DESC, size(fks) DESC, size(fcs) DESC, size(fdts) DESC, dr.name ASC 
RETURN dr, dan, ddts, dcs, diis, dks
Limit 5
  `,
      ({ records }) =>
        records.map((record) => {
          var _temp = record.get("dr");
          _temp.author = record.get("dan");
          _temp.dietTypes = record.get("ddts");
          _temp.ingredients = record.get("diis");
          _temp.collections = record.get("dcs");
          _temp.keywords = record.get("dks");
          return _temp;
        })
    )
  );
});

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

async function QuerryNeo4jDB(querry, cb = PackageResponse) {
  console.log(querry);
  console.log();
  console.log();
  console.log();
  var opts = { database: "neo4j" };
  return cb(await driver.executeQuery(querry, {}, opts));
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

  [...sortProperty.order, "recipe_name"].forEach((key, index) => {
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
