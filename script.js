/* ═══════════════════════════════════════════════════════
   CLEAR FIELD — Iowa Water Watch
   script.js · Harbor Neill

   This file handles all the interactivity for the site:
   1. Theme toggle (light/dark mode with localStorage)
   2. Scroll reveal animations (IntersectionObserver)
   3. Contaminant display (click nav buttons to show info)
   4. Leaflet map (Iowa counties, heat map, submission pins)
   5. Envelope kit popup (slides up after delay)
   6. Kit order form validation (envelope version)
   7. Connection card form validation (inline version)
   8. Cost calculator (add to cart, tax, checkout)
   9. Submit results form validation + customer object
═══════════════════════════════════════════════════════ */
"use strict";

/* 1. THEME TOGGLE
   Checks localStorage for a saved preference, defaults to light.
   Clicking the toggle button swaps the data-theme attribute on <html>
   which triggers all the CSS variable overrides for dark mode. */
var htmlEl = document.documentElement;
var themeToggle = document.getElementById("themeToggle");
var savedTheme = localStorage.getItem("clearfield-theme") || "light";
htmlEl.setAttribute("data-theme", savedTheme);
themeToggle.addEventListener("click", function () {
  var next = htmlEl.getAttribute("data-theme") === "light" ? "dark" : "light";
  htmlEl.setAttribute("data-theme", next);
  localStorage.setItem("clearfield-theme", next); // remember for next visit
});

/* 2. SCROLL REVEAL
   Elements with class "reveal" start invisible (opacity 0, translated down).
   When they scroll into view (10% visible), the observer adds "visible"
   which triggers a CSS transition to fade them in and slide up. */
var revealEls = document.querySelectorAll(".reveal");
var revealObserver = new IntersectionObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); revealObserver.unobserve(entry.target); }
  });
}, { threshold: 0.1 });
revealEls.forEach(function (el) { revealObserver.observe(el); });

/* 3. CONTAMINANT DISPLAY
   Each contaminant has its data stored in an object. Clicking a nav
   button renders that contaminant's info into the display panel.
   Only one shows at a time, and atrazine loads by default. */
var contaminants = {
  atrazine: { name:"Atrazine", type:"Herbicide", risk:"High Risk", riskClass:"risk-high", desc:"Atrazine is one of the most common herbicides in Iowa — sprayed on corn fields every spring, it seeps into groundwater and doesn't break down quickly. It's an endocrine disruptor, meaning it mimics and interferes with your hormones. Banned across Europe. Still legal here. Our kits test for it in every sample.", epa:"3 ppb", source:"Corn & soybean fields", halfLife:"60–100 days" },
  nitrates: { name:"Nitrates", type:"Fertilizer Runoff", risk:"High Risk", riskClass:"risk-high", desc:"Colorless. Odorless. Tasteless. You cannot detect nitrates without a test. They come from nitrogen fertilizers and animal manure, and they move fast through Iowa's tile-drained fields into drinking water. High levels cause blue baby syndrome in infants. Long-term exposure in adults is linked to colorectal cancer and thyroid disease.", epa:"10 mg/L", source:"Fertilizers & livestock", halfLife:"Weeks to months" },
  glyphosate: { name:"Glyphosate", type:"Herbicide", risk:"Medium Risk", riskClass:"risk-medium", desc:"The active ingredient in Roundup — used on virtually every Iowa cornfield. The EPA says it's fine at current levels. The World Health Organization says it's probably carcinogenic. The truth is, long-term low-dose research is still ongoing. What's certain: testing for it isn't federally required. We do it anyway.", epa:"700 ppb", source:"Commodity crop fields", halfLife:"Days to weeks" },
  arsenic: { name:"Arsenic", type:"Natural / Industrial", risk:"High Risk", riskClass:"risk-high", desc:"Arsenic occurs naturally in Iowa's bedrock and also enters water through old pesticides and industrial runoff. Private well owners — roughly 1 in 10 Iowa households — have no federal requirement to test for it. Long-term exposure causes bladder, lung, and skin cancer. There's no visible sign it's in your water.", epa:"10 ppb", source:"Bedrock geology, old pesticides", halfLife:"Indefinite" },
  lead: { name:"Lead", type:"Infrastructure", risk:"High Risk", riskClass:"risk-high", desc:"Lead gets into water through old pipes — and Iowa has thousands of them still in use. There is no safe level of lead exposure for children. None. Even tiny amounts cause permanent neurological damage and lower IQ. The EPA action level is 15 ppb, but the science says zero is the only acceptable number.", epa:"15 ppb action level", source:"Old pipes & plumbing", halfLife:"Indefinite" },
};
var cBtns = document.querySelectorAll(".c-btn");
var contaminantDisplay = document.getElementById("contaminantDisplay");
function renderContaminant(key) {
  var c = contaminants[key]; if (!c) return;
  contaminantDisplay.innerHTML = '<div class="c-content"><div class="c-header"><div><div class="c-type">' + c.type + '</div><div class="c-name">' + c.name + '</div></div><span class="c-risk-badge ' + c.riskClass + '">' + c.risk + '</span></div><p class="c-desc">' + c.desc + '</p><div class="c-meta"><div><div class="c-meta-label">EPA Safe Limit</div><div class="c-meta-value">' + c.epa + '</div></div><div><div class="c-meta-label">Primary Iowa Source</div><div class="c-meta-value">' + c.source + '</div></div><div><div class="c-meta-label">Half-Life</div><div class="c-meta-value">' + c.halfLife + '</div></div></div></div>';
}
cBtns.forEach(function (btn) {
  btn.addEventListener("click", function () {
    cBtns.forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    renderContaminant(btn.dataset.c);
  });
});
renderContaminant("atrazine");

/* 4. COUNTY DATA
   Each Iowa county has test data for nitrates and atrazine,
   a risk status (safe/warn/danger), a cancer incidence rate,
   and an array of family farm submissions with lat/lng for map pins.
   Data sourced from Iowa DNR and Iowa Cancer Registry. */
var countyData = {
  "Adair":{nitrate:7.2,atrazine:0.9,status:"warn",cancer:468,farms:[]},
  "Adams":{nitrate:5.8,atrazine:0.6,status:"safe",cancer:445,farms:[]},
  "Allamakee":{nitrate:6.1,atrazine:0.7,status:"safe",cancer:470,farms:[]},
  "Appanoose":{nitrate:8.5,atrazine:1.2,status:"warn",cancer:512,farms:[{name:"The Brown Family",level:"warn",date:"5 days ago",lat:40.74,lng:-92.87}]},
  "Audubon":{nitrate:9.1,atrazine:1.5,status:"warn",cancer:460,farms:[]},
  "Benton":{nitrate:8.8,atrazine:1.3,status:"warn",cancer:478,farms:[]},
  "Black Hawk":{nitrate:10.8,atrazine:1.4,status:"danger",cancer:502,farms:[{name:"Pinecrest Family Farm",level:"danger",date:"3 days ago",lat:42.47,lng:-92.31},{name:"Cedar Valley Co-op",level:"warn",date:"5 days ago",lat:42.51,lng:-92.35},{name:"The Williams Family",level:"safe",date:"1 week ago",lat:42.44,lng:-92.28}]},
  "Boone":{nitrate:7.5,atrazine:0.9,status:"warn",cancer:485,farms:[]},
  "Bremer":{nitrate:6.8,atrazine:0.8,status:"safe",cancer:462,farms:[]},
  "Buchanan":{nitrate:7.9,atrazine:1.0,status:"warn",cancer:470,farms:[]},
  "Buena Vista":{nitrate:11.5,atrazine:2.1,status:"danger",cancer:495,farms:[{name:"BV Grain Co-op",level:"danger",date:"6 days ago",lat:42.74,lng:-95.15}]},
  "Butler":{nitrate:9.8,atrazine:1.6,status:"warn",cancer:488,farms:[]},
  "Calhoun":{nitrate:14.6,atrazine:3.0,status:"danger",cancer:510,farms:[{name:"Rolling Hills Farm",level:"danger",date:"4 days ago",lat:42.39,lng:-94.64},{name:"The Swanson Family",level:"danger",date:"1 week ago",lat:42.36,lng:-94.58}]},
  "Carroll":{nitrate:8.2,atrazine:1.1,status:"warn",cancer:476,farms:[]},
  "Cass":{nitrate:7.0,atrazine:0.8,status:"warn",cancer:455,farms:[]},
  "Cedar":{nitrate:6.5,atrazine:0.7,status:"safe",cancer:462,farms:[]},
  "Cerro Gordo":{nitrate:11.9,atrazine:1.8,status:"danger",cancer:518,farms:[{name:"Carol Andersen",level:"danger",date:"2 days ago",lat:43.08,lng:-93.26},{name:"North Star Farm",level:"warn",date:"1 week ago",lat:43.12,lng:-93.22},{name:"The Burgess Family",level:"danger",date:"1 week ago",lat:43.05,lng:-93.30}]},
  "Cherokee":{nitrate:10.2,atrazine:1.7,status:"danger",cancer:490,farms:[]},
  "Chickasaw":{nitrate:7.4,atrazine:0.9,status:"warn",cancer:465,farms:[]},
  "Clarke":{nitrate:6.0,atrazine:0.6,status:"safe",cancer:450,farms:[]},
  "Clay":{nitrate:12.8,atrazine:2.6,status:"danger",cancer:505,farms:[{name:"Sunrise Acres Farm",level:"danger",date:"yesterday",lat:43.08,lng:-95.15},{name:"Clay County Co-op",level:"warn",date:"3 days ago",lat:43.05,lng:-95.10}]},
  "Clayton":{nitrate:5.5,atrazine:0.5,status:"safe",cancer:455,farms:[]},
  "Clinton":{nitrate:7.8,atrazine:1.0,status:"warn",cancer:482,farms:[]},
  "Crawford":{nitrate:9.5,atrazine:1.5,status:"warn",cancer:478,farms:[]},
  "Dallas":{nitrate:6.2,atrazine:0.6,status:"safe",cancer:458,farms:[]},
  "Davis":{nitrate:5.0,atrazine:0.4,status:"safe",cancer:440,farms:[]},
  "Decatur":{nitrate:12.1,atrazine:2.1,status:"danger",cancer:522,farms:[{name:"The O'Brien Family",level:"danger",date:"5 days ago",lat:40.73,lng:-93.83},{name:"Southern Iowa Grain",level:"warn",date:"1 week ago",lat:40.76,lng:-93.78}]},
  "Delaware":{nitrate:6.4,atrazine:0.7,status:"safe",cancer:460,farms:[]},
  "Des Moines":{nitrate:7.6,atrazine:0.9,status:"warn",cancer:488,farms:[]},
  "Dickinson":{nitrate:8.0,atrazine:1.1,status:"warn",cancer:468,farms:[]},
  "Dubuque":{nitrate:5.8,atrazine:0.5,status:"safe",cancer:472,farms:[]},
  "Emmet":{nitrate:10.5,atrazine:1.8,status:"danger",cancer:498,farms:[]},
  "Fayette":{nitrate:7.1,atrazine:0.8,status:"warn",cancer:465,farms:[]},
  "Floyd":{nitrate:9.2,atrazine:1.4,status:"warn",cancer:480,farms:[]},
  "Franklin":{nitrate:11.0,atrazine:1.9,status:"danger",cancer:492,farms:[]},
  "Fremont":{nitrate:6.5,atrazine:0.7,status:"safe",cancer:448,farms:[]},
  "Greene":{nitrate:10.8,atrazine:1.8,status:"danger",cancer:495,farms:[]},
  "Grundy":{nitrate:9.5,atrazine:1.5,status:"warn",cancer:478,farms:[]},
  "Guthrie":{nitrate:7.8,atrazine:1.0,status:"warn",cancer:462,farms:[]},
  "Hamilton":{nitrate:12.0,atrazine:2.2,status:"danger",cancer:508,farms:[]},
  "Hancock":{nitrate:11.2,atrazine:2.0,status:"danger",cancer:498,farms:[]},
  "Hardin":{nitrate:12.3,atrazine:2.2,status:"danger",cancer:515,farms:[{name:"The Hansen Family",level:"danger",date:"2 hrs ago",lat:42.47,lng:-93.24},{name:"Ridgeline Farm",level:"warn",date:"4 days ago",lat:42.50,lng:-93.28},{name:"Tom & Brenda K.",level:"warn",date:"1 week ago",lat:42.44,lng:-93.20}]},
  "Harrison":{nitrate:7.5,atrazine:0.9,status:"warn",cancer:460,farms:[]},
  "Henry":{nitrate:6.8,atrazine:0.8,status:"safe",cancer:465,farms:[]},
  "Howard":{nitrate:7.0,atrazine:0.8,status:"warn",cancer:458,farms:[]},
  "Humboldt":{nitrate:13.0,atrazine:2.5,status:"danger",cancer:505,farms:[]},
  "Ida":{nitrate:8.5,atrazine:1.2,status:"warn",cancer:470,farms:[]},
  "Iowa":{nitrate:6.0,atrazine:0.6,status:"safe",cancer:455,farms:[]},
  "Jackson":{nitrate:5.5,atrazine:0.5,status:"safe",cancer:452,farms:[]},
  "Jasper":{nitrate:11.2,atrazine:1.9,status:"danger",cancer:508,farms:[{name:"Prairie Rose Farm",level:"danger",date:"3 days ago",lat:41.69,lng:-93.05},{name:"The Jensen Family",level:"warn",date:"6 days ago",lat:41.72,lng:-93.00}]},
  "Jefferson":{nitrate:6.2,atrazine:0.6,status:"safe",cancer:448,farms:[]},
  "Johnson":{nitrate:4.6,atrazine:0.5,status:"safe",cancer:438,farms:[{name:"The Osei Family",level:"safe",date:"2 days ago",lat:41.66,lng:-91.53},{name:"Iowa City Backyard",level:"safe",date:"5 days ago",lat:41.63,lng:-91.55}]},
  "Jones":{nitrate:6.5,atrazine:0.7,status:"safe",cancer:458,farms:[]},
  "Keokuk":{nitrate:7.8,atrazine:1.0,status:"warn",cancer:470,farms:[]},
  "Kossuth":{nitrate:14.2,atrazine:3.1,status:"danger",cancer:520,farms:[{name:"Hansen Family Farm",level:"danger",date:"2 hrs ago",lat:43.20,lng:-94.22},{name:"Bluebird Acres",level:"danger",date:"3 days ago",lat:43.18,lng:-94.18},{name:"The Larson Family",level:"warn",date:"1 week ago",lat:43.15,lng:-94.25}]},
  "Lee":{nitrate:7.2,atrazine:0.9,status:"warn",cancer:478,farms:[]},
  "Linn":{nitrate:6.8,atrazine:0.8,status:"warn",cancer:475,farms:[{name:"Cedar Rapids Co-op",level:"warn",date:"4 days ago",lat:42.03,lng:-91.64},{name:"The Hoffman Family",level:"safe",date:"6 days ago",lat:42.00,lng:-91.60}]},
  "Louisa":{nitrate:8.0,atrazine:1.1,status:"warn",cancer:468,farms:[]},
  "Lucas":{nitrate:5.5,atrazine:0.5,status:"safe",cancer:442,farms:[]},
  "Lyon":{nitrate:8.8,atrazine:1.3,status:"warn",cancer:462,farms:[]},
  "Madison":{nitrate:6.5,atrazine:0.7,status:"safe",cancer:455,farms:[]},
  "Mahaska":{nitrate:7.5,atrazine:0.9,status:"warn",cancer:472,farms:[]},
  "Marion":{nitrate:6.8,atrazine:0.8,status:"safe",cancer:460,farms:[]},
  "Marshall":{nitrate:11.0,atrazine:1.5,status:"danger",cancer:498,farms:[{name:"The Nguyen Family",level:"warn",date:"yesterday",lat:42.04,lng:-92.91},{name:"Marshalltown Family Farm",level:"danger",date:"4 days ago",lat:42.07,lng:-92.88}]},
  "Mills":{nitrate:6.2,atrazine:0.6,status:"safe",cancer:445,farms:[]},
  "Mitchell":{nitrate:8.5,atrazine:1.2,status:"warn",cancer:475,farms:[]},
  "Monona":{nitrate:7.8,atrazine:1.0,status:"warn",cancer:465,farms:[]},
  "Monroe":{nitrate:5.8,atrazine:0.5,status:"safe",cancer:448,farms:[]},
  "Montgomery":{nitrate:7.0,atrazine:0.8,status:"warn",cancer:458,farms:[]},
  "Muscatine":{nitrate:7.5,atrazine:0.9,status:"warn",cancer:478,farms:[]},
  "O'Brien":{nitrate:10.8,atrazine:1.8,status:"danger",cancer:492,farms:[]},
  "Osceola":{nitrate:9.0,atrazine:1.3,status:"warn",cancer:468,farms:[]},
  "Page":{nitrate:6.8,atrazine:0.8,status:"safe",cancer:452,farms:[]},
  "Palo Alto":{nitrate:13.5,atrazine:2.9,status:"danger",cancer:512,farms:[{name:"The Voss Family",level:"danger",date:"2 days ago",lat:43.08,lng:-94.68},{name:"Prairie Wind Farm",level:"danger",date:"5 days ago",lat:43.05,lng:-94.72}]},
  "Plymouth":{nitrate:9.8,atrazine:1.6,status:"warn",cancer:480,farms:[]},
  "Pocahontas":{nitrate:15.1,atrazine:3.4,status:"danger",cancer:525,farms:[{name:"Sunrise Acres Farm",level:"danger",date:"yesterday",lat:42.74,lng:-94.68},{name:"The Kowalski Family",level:"warn",date:"4 days ago",lat:42.71,lng:-94.64}]},
  "Polk":{nitrate:6.5,atrazine:0.7,status:"warn",cancer:468,farms:[{name:"The Martinez Family",level:"warn",date:"3 days ago",lat:41.60,lng:-93.61},{name:"Des Moines Urban Garden",level:"safe",date:"4 days ago",lat:41.58,lng:-93.58}]},
  "Pottawattamie":{nitrate:10.9,atrazine:1.5,status:"danger",cancer:495,farms:[{name:"The Ramirez Family",level:"danger",date:"5 days ago",lat:41.26,lng:-95.79},{name:"Council Bluffs Grain",level:"warn",date:"1 week ago",lat:41.23,lng:-95.82}]},
  "Poweshiek":{nitrate:8.0,atrazine:1.1,status:"warn",cancer:472,farms:[]},
  "Ringgold":{nitrate:6.5,atrazine:0.7,status:"safe",cancer:448,farms:[]},
  "Sac":{nitrate:10.0,atrazine:1.7,status:"danger",cancer:488,farms:[]},
  "Scott":{nitrate:6.0,atrazine:0.6,status:"safe",cancer:465,farms:[]},
  "Shelby":{nitrate:8.2,atrazine:1.1,status:"warn",cancer:468,farms:[]},
  "Sioux":{nitrate:11.5,atrazine:2.0,status:"danger",cancer:498,farms:[]},
  "Story":{nitrate:4.8,atrazine:0.5,status:"safe",cancer:435,farms:[{name:"The Nguyen Family",level:"safe",date:"yesterday",lat:42.03,lng:-93.47},{name:"Ames Family Garden",level:"safe",date:"3 days ago",lat:42.05,lng:-93.45},{name:"Iowa State Extension",level:"safe",date:"1 week ago",lat:42.01,lng:-93.50}]},
  "Tama":{nitrate:9.0,atrazine:1.3,status:"warn",cancer:475,farms:[]},
  "Taylor":{nitrate:5.8,atrazine:0.5,status:"safe",cancer:440,farms:[]},
  "Union":{nitrate:6.2,atrazine:0.6,status:"safe",cancer:445,farms:[]},
  "Van Buren":{nitrate:5.5,atrazine:0.5,status:"safe",cancer:442,farms:[]},
  "Wapello":{nitrate:13.0,atrazine:2.4,status:"danger",cancer:518,farms:[{name:"The Brown Family",level:"danger",date:"4 days ago",lat:41.03,lng:-92.41},{name:"Ottumwa Acres",level:"warn",date:"1 week ago",lat:41.06,lng:-92.38}]},
  "Warren":{nitrate:6.0,atrazine:0.6,status:"safe",cancer:452,farms:[]},
  "Washington":{nitrate:7.2,atrazine:0.9,status:"warn",cancer:465,farms:[]},
  "Wayne":{nitrate:5.2,atrazine:0.4,status:"safe",cancer:438,farms:[]},
  "Webster":{nitrate:13.2,atrazine:2.5,status:"danger",cancer:512,farms:[{name:"The Petersen Family",level:"danger",date:"4 days ago",lat:42.46,lng:-94.18},{name:"Fort Dodge Acres",level:"warn",date:"6 days ago",lat:42.49,lng:-94.15}]},
  "Winnebago":{nitrate:10.0,atrazine:1.6,status:"danger",cancer:490,farms:[]},
  "Winneshiek":{nitrate:5.8,atrazine:0.5,status:"safe",cancer:452,farms:[]},
  "Woodbury":{nitrate:11.4,atrazine:1.6,status:"danger",cancer:508,farms:[{name:"The Okonkwo Family",level:"danger",date:"3 days ago",lat:42.50,lng:-96.40},{name:"Siouxland Farms",level:"warn",date:"5 days ago",lat:42.47,lng:-96.37}]},
  "Worth":{nitrate:9.5,atrazine:1.4,status:"warn",cancer:482,farms:[]},
  "Wright":{nitrate:13.8,atrazine:2.8,status:"danger",cancer:515,farms:[{name:"Miller & Sons Grain",level:"danger",date:"2 days ago",lat:42.74,lng:-93.74},{name:"The Erikson Family",level:"danger",date:"6 days ago",lat:42.71,lng:-93.70}]},
};

/* ── MAP INITIALIZATION ────────────────────────────── */
/* Using Leaflet.js with CartoDB light tiles (no API key needed).
   Counties are drawn as GeoJSON rectangles positioned at approximate
   lat/lng centers. Two views: water quality heat map (with pins)
   and cancer rate heat map. User can pan and zoom but not click counties. */
var currentView = "water";
var leafletMap, countyLayer, pinLayer;

/* color scale for water contamination — green (safe) to red (high) */

function waterColor(n){var d=countyData[n];if(!d)return"#e8e4d8";var v=d.nitrate;if(v<=5)return"#c8dfc0";if(v<=8)return"#dfe8c0";if(v<=10)return"#dfd0a0";if(v<=13)return"#e8b0a0";return"#c8543a";}
function cancerColor(n){var d=countyData[n];if(!d)return"#e8e4d8";var v=d.cancer;if(v<=445)return"#d4e8f0";if(v<=465)return"#a8c8d8";if(v<=485)return"#8FABC0";if(v<=505)return"#7a6da0";return"#4a1942";}
function getStyle(n){return{fillColor:currentView==="water"?waterColor(n):cancerColor(n),fillOpacity:0.78,weight:1,color:"rgba(56,73,51,0.25)",opacity:1};}

function genCounties(){
  var c=[
    {n:"Lyon",la:43.38,lo:-96.21,w:.60,h:.30},{n:"Osceola",la:43.38,lo:-95.62,w:.55,h:.30},{n:"Dickinson",la:43.38,lo:-95.05,w:.55,h:.30},{n:"Emmet",la:43.38,lo:-94.68,w:.45,h:.30},{n:"Kossuth",la:43.20,lo:-94.22,w:.70,h:.55},{n:"Winnebago",la:43.38,lo:-93.74,w:.45,h:.30},{n:"Worth",la:43.38,lo:-93.30,w:.45,h:.30},{n:"Mitchell",la:43.38,lo:-92.87,w:.45,h:.30},{n:"Howard",la:43.38,lo:-92.32,w:.55,h:.30},{n:"Winneshiek",la:43.38,lo:-91.75,w:.55,h:.30},{n:"Allamakee",la:43.38,lo:-91.20,w:.55,h:.30},
    {n:"Sioux",la:43.08,lo:-96.21,w:.60,h:.30},{n:"O'Brien",la:43.08,lo:-95.62,w:.55,h:.30},{n:"Clay",la:43.08,lo:-95.15,w:.45,h:.30},{n:"Palo Alto",la:43.08,lo:-94.68,w:.45,h:.30},{n:"Hancock",la:43.08,lo:-93.74,w:.45,h:.30},{n:"Cerro Gordo",la:43.08,lo:-93.26,w:.50,h:.30},{n:"Floyd",la:43.08,lo:-92.78,w:.45,h:.30},{n:"Chickasaw",la:43.08,lo:-92.32,w:.45,h:.30},{n:"Fayette",la:43.08,lo:-91.80,w:.50,h:.30},{n:"Clayton",la:43.08,lo:-91.28,w:.50,h:.30},
    {n:"Plymouth",la:42.74,lo:-96.21,w:.60,h:.30},{n:"Cherokee",la:42.74,lo:-95.62,w:.55,h:.30},{n:"Buena Vista",la:42.74,lo:-95.15,w:.45,h:.30},{n:"Pocahontas",la:42.74,lo:-94.68,w:.45,h:.30},{n:"Humboldt",la:42.74,lo:-94.22,w:.45,h:.30},{n:"Wright",la:42.74,lo:-93.74,w:.50,h:.30},{n:"Franklin",la:42.74,lo:-93.26,w:.50,h:.30},{n:"Butler",la:42.74,lo:-92.78,w:.45,h:.30},{n:"Bremer",la:42.74,lo:-92.32,w:.45,h:.30},{n:"Buchanan",la:42.74,lo:-91.80,w:.50,h:.30},{n:"Delaware",la:42.74,lo:-91.28,w:.50,h:.30},{n:"Dubuque",la:42.74,lo:-90.78,w:.48,h:.30},
    {n:"Woodbury",la:42.40,lo:-96.30,w:.60,h:.38},{n:"Ida",la:42.40,lo:-95.52,w:.45,h:.30},{n:"Sac",la:42.40,lo:-95.05,w:.50,h:.30},{n:"Calhoun",la:42.40,lo:-94.64,w:.45,h:.30},{n:"Webster",la:42.46,lo:-94.18,w:.45,h:.38},{n:"Hamilton",la:42.40,lo:-93.70,w:.50,h:.30},{n:"Hardin",la:42.40,lo:-93.24,w:.50,h:.30},{n:"Grundy",la:42.40,lo:-92.78,w:.45,h:.30},{n:"Black Hawk",la:42.47,lo:-92.31,w:.50,h:.38},{n:"Jackson",la:42.18,lo:-90.58,w:.50,h:.38},
    {n:"Monona",la:42.05,lo:-96.00,w:.55,h:.30},{n:"Crawford",la:42.05,lo:-95.38,w:.55,h:.30},{n:"Carroll",la:42.05,lo:-94.86,w:.50,h:.30},{n:"Greene",la:42.05,lo:-94.36,w:.50,h:.30},{n:"Boone",la:42.05,lo:-93.93,w:.45,h:.30},{n:"Story",la:42.03,lo:-93.47,w:.50,h:.30},{n:"Marshall",la:42.05,lo:-92.91,w:.55,h:.30},{n:"Tama",la:42.05,lo:-92.35,w:.55,h:.30},{n:"Benton",la:42.05,lo:-91.93,w:.40,h:.30},{n:"Linn",la:42.05,lo:-91.58,w:.45,h:.30},{n:"Jones",la:42.12,lo:-91.10,w:.45,h:.30},
    {n:"Harrison",la:41.70,lo:-95.82,w:.55,h:.30},{n:"Shelby",la:41.70,lo:-95.32,w:.50,h:.30},{n:"Audubon",la:41.70,lo:-94.90,w:.40,h:.30},{n:"Guthrie",la:41.70,lo:-94.50,w:.40,h:.30},{n:"Dallas",la:41.70,lo:-94.04,w:.45,h:.30},{n:"Polk",la:41.60,lo:-93.58,w:.55,h:.38},{n:"Jasper",la:41.69,lo:-93.05,w:.55,h:.30},{n:"Poweshiek",la:41.70,lo:-92.52,w:.50,h:.30},{n:"Iowa",la:41.70,lo:-92.06,w:.45,h:.30},{n:"Johnson",la:41.66,lo:-91.58,w:.45,h:.30},{n:"Cedar",la:41.76,lo:-91.13,w:.45,h:.30},{n:"Clinton",la:41.84,lo:-90.55,w:.50,h:.35},
    {n:"Pottawattamie",la:41.26,lo:-95.55,w:.65,h:.38},{n:"Cass",la:41.35,lo:-94.93,w:.45,h:.30},{n:"Adair",la:41.35,lo:-94.47,w:.45,h:.30},{n:"Madison",la:41.35,lo:-94.02,w:.45,h:.30},{n:"Warren",la:41.35,lo:-93.56,w:.45,h:.30},{n:"Marion",la:41.35,lo:-93.10,w:.45,h:.30},{n:"Mahaska",la:41.35,lo:-92.64,w:.45,h:.30},{n:"Keokuk",la:41.35,lo:-92.18,w:.45,h:.30},{n:"Washington",la:41.35,lo:-91.72,w:.45,h:.30},{n:"Louisa",la:41.22,lo:-91.25,w:.45,h:.30},{n:"Muscatine",la:41.48,lo:-91.03,w:.45,h:.30},{n:"Scott",la:41.60,lo:-90.55,w:.45,h:.30},
    {n:"Mills",la:41.00,lo:-95.62,w:.45,h:.30},{n:"Montgomery",la:41.00,lo:-95.18,w:.45,h:.30},{n:"Adams",la:41.00,lo:-94.70,w:.45,h:.30},{n:"Union",la:41.00,lo:-94.24,w:.45,h:.30},{n:"Clarke",la:41.00,lo:-93.78,w:.45,h:.30},{n:"Lucas",la:41.00,lo:-93.32,w:.45,h:.30},{n:"Monroe",la:41.00,lo:-92.86,w:.45,h:.30},{n:"Wapello",la:41.03,lo:-92.41,w:.45,h:.30},{n:"Jefferson",la:41.00,lo:-91.95,w:.45,h:.30},{n:"Henry",la:41.00,lo:-91.55,w:.40,h:.30},{n:"Des Moines",la:41.00,lo:-91.15,w:.40,h:.30},
    {n:"Fremont",la:40.72,lo:-95.62,w:.45,h:.30},{n:"Page",la:40.72,lo:-95.18,w:.45,h:.30},{n:"Taylor",la:40.72,lo:-94.70,w:.45,h:.30},{n:"Ringgold",la:40.72,lo:-94.24,w:.45,h:.30},{n:"Decatur",la:40.72,lo:-93.83,w:.45,h:.30},{n:"Wayne",la:40.72,lo:-93.32,w:.50,h:.30},{n:"Appanoose",la:40.72,lo:-92.87,w:.45,h:.30},{n:"Davis",la:40.72,lo:-92.41,w:.45,h:.30},{n:"Van Buren",la:40.72,lo:-91.95,w:.45,h:.30},{n:"Lee",la:40.72,lo:-91.45,w:.50,h:.30}
  ];
  return{type:"FeatureCollection",features:c.map(function(o){var hw=o.w/2,hh=o.h/2;return{type:"Feature",properties:{name:o.n},geometry:{type:"Polygon",coordinates:[[[o.lo-hw,o.la-hh],[o.lo+hw,o.la-hh],[o.lo+hw,o.la+hh],[o.lo-hw,o.la+hh],[o.lo-hw,o.la-hh]]]}};})};
}

function addPins(){
  pinLayer.clearLayers();
  if(currentView!=="water")return;
  Object.keys(countyData).forEach(function(county){
    var d=countyData[county];if(!d.farms||!d.farms.length)return;
    d.farms.forEach(function(f){
      if(!f.lat||!f.lng)return;
      var icon=L.divIcon({className:"",html:'<div class="pin-marker pin-'+f.level+'"></div>',iconSize:[12,12],iconAnchor:[6,6]});
      var m=L.marker([f.lat,f.lng],{icon:icon,interactive:true});
      m.bindTooltip('<span class="pin-tip-county">'+county+' County</span><span class="pin-tip-date">'+f.date+'</span>',{className:"pin-tooltip",direction:"top",offset:[0,-8]});
      pinLayer.addLayer(m);
    });
  });
}

function setView(view){
  currentView=view;
  document.getElementById("toggleWater").classList.toggle("active",view==="water");
  document.getElementById("toggleCancer").classList.toggle("active",view==="cancer");
  countyLayer.eachLayer(function(l){l.setStyle(getStyle(l.feature.properties.name));});
  if(view==="water"){addPins();document.getElementById("pinLegend").style.display="flex";}
  else{pinLayer.clearLayers();document.getElementById("pinLegend").style.display="none";}
  var bar=document.getElementById("gradientBar"),labels=document.getElementById("gradientLabels"),label=document.getElementById("legendLabel");
  if(view==="water"){bar.className="gradient-bar water";labels.innerHTML="<span>Safe</span><span>Elevated</span><span>High</span>";label.textContent="Contamination Level";}
  else{bar.className="gradient-bar cancer";labels.innerHTML="<span>Lower</span><span>Average</span><span>Higher</span>";label.textContent="Cancer Incidence";}
}

function initMap(){
  if(!document.getElementById("iowaMap"))return;
  leafletMap=L.map("iowaMap",{center:[42.0,-93.5],zoom:7,minZoom:7,maxZoom:10,zoomControl:true,attributionControl:false,scrollWheelZoom:true,dragging:true});
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:20}).addTo(leafletMap);
  leafletMap.setMaxBounds(L.latLngBounds(L.latLng(40.0,-97.2),L.latLng(43.8,-89.5)));
  countyLayer=L.geoJSON(genCounties(),{
    style:function(f){return getStyle(f.properties.name);},
    onEachFeature:function(f,layer){
      var name=f.properties.name;
      layer.bindTooltip(name+" County",{className:"county-hover-tooltip",sticky:true,direction:"top",offset:[0,-8]});
      layer.on("mouseover",function(){layer.setStyle({weight:2,color:"#384933",fillOpacity:0.9});layer.bringToFront();if(pinLayer)pinLayer.eachLayer(function(m){m.bringToFront();});});
      layer.on("mouseout",function(){layer.setStyle(getStyle(name));});
    }
  }).addTo(leafletMap);
  pinLayer=L.layerGroup().addTo(leafletMap);
  addPins();
  document.getElementById("toggleWater").addEventListener("click",function(){setView("water");});
  document.getElementById("toggleCancer").addEventListener("click",function(){setView("cancer");});
}

initMap();


/* ─────────────────────────────────────────────────────
   5. ENVELOPE KIT POPUP
───────────────────────────────────────────────────── */
var envelopeOverlay = document.getElementById("envelopeOverlay");
var envelopeClose   = document.getElementById("envelopeClose");
var envelopeShown   = false;

function openEnvelope() {
  if (envelopeShown) return;
  envelopeShown = true;
  envelopeOverlay.style.display = "flex";
  requestAnimationFrame(function () { requestAnimationFrame(function () { envelopeOverlay.classList.add("active"); }); });
}
function closeEnvelope() {
  envelopeOverlay.classList.remove("active");
  setTimeout(function () { envelopeOverlay.style.display = "none"; }, 600);
}
if (envelopeClose) envelopeClose.addEventListener("click", closeEnvelope);
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && envelopeOverlay.classList.contains("active")) closeEnvelope(); });

var mapSection = document.getElementById("map");
if (mapSection) {
  var mapWatcher = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !envelopeShown) {
        setTimeout(openEnvelope, 30000);
      }
    });
  }, { threshold: 0.3 });
  mapWatcher.observe(mapSection);
}

window.openEnvelope = openEnvelope;
var headerKitBtn = document.getElementById("headerKitBtn");
if (headerKitBtn) {
  headerKitBtn.addEventListener("click", function (e) { e.preventDefault(); openEnvelope(); });
}


/* ─────────────────────────────────────────────────────
   6. KIT ORDER FORM (envelope)
───────────────────────────────────────────────────── */
var REGEX_EMAIL   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var REGEX_NAME    = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF '\-]{2,}$/;
var REGEX_COUNTY  = /^[A-Za-z '\-]{2,}$/;
var REGEX_ADDRESS = /^.{6,}$/;
var REGEX_PHONE   = /^\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/;

function showErr(fId,eId,msg){var f=document.getElementById(fId),e=document.getElementById(eId);if(f)f.classList.add("error");if(e)e.textContent=msg;}
function clearErr(fId,eId){var f=document.getElementById(fId),e=document.getElementById(eId);if(f)f.classList.remove("error");if(e)e.textContent="";}

var kitForm=document.getElementById("kitForm");
var kitSuccess=document.getElementById("kitSuccess");
if(kitForm){
  kitForm.addEventListener("submit",function(e){
    e.preventDefault();
    var valid=true;
    ["kitFirst","kitLast","kitEmail","kitAddress","kitCounty"].forEach(function(id){clearErr(id,id+"Error");});
    var first=document.getElementById("kitFirst").value.trim();
    var last=document.getElementById("kitLast").value.trim();
    var email=document.getElementById("kitEmail").value.trim();
    var address=document.getElementById("kitAddress").value.trim();
    var county=document.getElementById("kitCounty").value.trim();
    if(!first||!REGEX_NAME.test(first)){showErr("kitFirst","kitFirstError","Please enter your first name.");valid=false;}
    if(!last||!REGEX_NAME.test(last)){showErr("kitLast","kitLastError","Please enter your last name.");valid=false;}
    if(!email||!REGEX_EMAIL.test(email)){showErr("kitEmail","kitEmailError","Please enter a valid email.");valid=false;}
    if(!address||!REGEX_ADDRESS.test(address)){showErr("kitAddress","kitAddressError","Please enter your address.");valid=false;}
    if(!county||!REGEX_COUNTY.test(county)){showErr("kitCounty","kitCountyError","Please enter your county.");valid=false;}
    if(!valid)return;
    var acct={firstName:first,lastName:last,email:email,address:address,county:county,accountId:"CF-"+Math.random().toString(36).substr(2,8).toUpperCase(),createdAt:new Date().toLocaleString("en-US")};
    kitForm.style.display="none";
    kitSuccess.style.display="block";
    kitSuccess.innerHTML='<h4>Kit on its way, '+acct.firstName+'.</h4><p>We\'re mailing your free kit to <strong>'+acct.address+'</strong>. Should arrive in 3–5 days.</p><p class="courier kit-acct-line">Account: '+acct.accountId+'</p>';
  });
}


/* ─────────────────────────────────────────────────────
   7. CONNECTION CARD FORM
───────────────────────────────────────────────────── */
var connectForm=document.getElementById("connectForm");
var connectSuccess=document.getElementById("connectSuccess");
if(connectForm){
  connectForm.addEventListener("submit",function(e){
    e.preventDefault();
    var valid=true;
    ["connectName","connectAddress","connectCounty","connectEmail"].forEach(function(id){clearErr(id,id+"Error");});
    var name=document.getElementById("connectName").value.trim();
    var addr=document.getElementById("connectAddress").value.trim();
    var county=document.getElementById("connectCounty").value.trim();
    var email=document.getElementById("connectEmail").value.trim();
    if(!name||name.length<2){showErr("connectName","connectNameError","Please enter your name.");valid=false;}
    if(!addr||addr.length<6){showErr("connectAddress","connectAddressError","Please enter your mailing address.");valid=false;}
    if(!county||!REGEX_COUNTY.test(county)){showErr("connectCounty","connectCountyError","Please enter your county.");valid=false;}
    if(!email||!REGEX_EMAIL.test(email)){showErr("connectEmail","connectEmailError","Please enter a valid email.");valid=false;}
    if(!valid)return;
    connectForm.style.display="none";
    connectSuccess.classList.add("visible");
    connectSuccess.innerHTML='<h3>You\'re in, '+name.split(" ")[0]+'.</h3><p>Your free water test kit is on its way to <strong>'+addr+'</strong>. Keep an eye on your inbox at <strong>'+email+'</strong> for tracking info.</p>';
  });
}


/* ─────────────────────────────────────────────────────
   8. COST CALCULATOR
───────────────────────────────────────────────────── */
var cart = [];
var TAX_RATE = 0.06;
var calcAddBtns = document.querySelectorAll(".calc-add-btn");
var donationBtns = document.querySelectorAll(".donation-btn");
var cartItemsEl = document.getElementById("cartItems");
var cartEmptyEl = document.getElementById("cartEmpty");
var calcSubtotalEl = document.getElementById("calcSubtotal");
var calcTaxEl = document.getElementById("calcTax");
var calcShippingEl = document.getElementById("calcShipping");
var calcTotalPriceEl = document.getElementById("calcTotalPrice");
var calcCheckoutBtn = document.getElementById("calcCheckout");
var calcCheckoutMsg = document.getElementById("calcCheckoutMsg");
var currentDonation = 50;

// Donation amount selector
donationBtns.forEach(function(btn){
  btn.addEventListener("click",function(){
    donationBtns.forEach(function(b){b.classList.remove("active");});
    btn.classList.add("active");
    currentDonation = parseInt(btn.dataset.amount);
    // Update the fund add button
    var fundBtn = document.querySelector('.calc-add-btn[data-product="fund"]');
    if(fundBtn){fundBtn.dataset.price=currentDonation;fundBtn.dataset.name="Accountability Fund — $"+currentDonation;}
  });
});

// Add to cart
calcAddBtns.forEach(function(btn){
  btn.addEventListener("click",function(){
    var product = btn.dataset.product;
    var price = parseFloat(btn.dataset.price);
    var name = btn.dataset.name;
    if(product==="fund"){price=currentDonation;name="Accountability Fund — $"+currentDonation;}
    cart.push({id:product+"-"+Date.now(),product:product,name:name,price:price});
    updateCart();
    calcCheckoutMsg.textContent="";
    calcCheckoutMsg.className="calc-checkout-msg";
  });
});

function updateCart(){
  if(cart.length===0){
    cartEmptyEl.style.display="block";
    cartItemsEl.innerHTML="";
  } else {
    cartEmptyEl.style.display="none";
    cartItemsEl.innerHTML=cart.map(function(item){
      return '<div class="calc-cart-item"><span class="calc-cart-item-name">'+item.name+'</span><span class="calc-cart-item-price">$'+item.price.toFixed(2)+'</span><button class="calc-cart-item-remove" data-id="'+item.id+'">✕</button></div>';
    }).join("");
    // Attach remove handlers
    document.querySelectorAll(".calc-cart-item-remove").forEach(function(btn){
      btn.addEventListener("click",function(){
        cart=cart.filter(function(i){return i.id!==btn.dataset.id;});
        updateCart();
      });
    });
  }
  // Calculate totals
  var subtotal=0;var taxableTotal=0;
  cart.forEach(function(item){
    subtotal+=item.price;
    if(item.product!=="fund")taxableTotal+=item.price;
  });
  var tax=taxableTotal*TAX_RATE;
  var total=subtotal+tax;
  calcSubtotalEl.textContent="$"+subtotal.toFixed(2);
  calcTaxEl.textContent="$"+tax.toFixed(2);
  calcShippingEl.textContent="Free";
  calcTotalPriceEl.textContent="$"+total.toFixed(2);
}

// Checkout
if(calcCheckoutBtn){
  calcCheckoutBtn.addEventListener("click",function(){
    if(cart.length===0){
      calcCheckoutMsg.textContent="Please add something to your cart before checking out.";
      calcCheckoutMsg.className="calc-checkout-msg warning";
      return;
    }
    var total=calcTotalPriceEl.textContent;
    cart=[];
    updateCart();
    calcCheckoutMsg.className="calc-checkout-msg success";
    calcCheckoutMsg.innerHTML="Thank you for your order.<br/><span class='checkout-total-line'>Total charged: "+total+"</span>";
  });
}


/* ─────────────────────────────────────────────────────
   9. SUBMIT RESULTS FORM
───────────────────────────────────────────────────── */
var submitForm=document.getElementById("submitForm");
var formSuccess=document.getElementById("formSuccess");

if(submitForm){
  submitForm.addEventListener("submit",function(e){
    e.preventDefault();
    var valid=true;
    var firstName=document.getElementById("firstName").value.trim();
    var lastName=document.getElementById("lastName").value.trim();
    var email=document.getElementById("email").value.trim();
    var phone=document.getElementById("phone").value.trim();
    var county=document.getElementById("county").value.trim();
    var comments=document.getElementById("comments").value.trim();
    var contactMethod=document.querySelector('input[name="contactMethod"]:checked');

    ["firstName","lastName","email","phone","county","comments"].forEach(function(id){clearErr(id,id+"Error");});
    var cmErr=document.getElementById("contactMethodError");if(cmErr)cmErr.textContent="";

    if(!firstName||!REGEX_NAME.test(firstName)){showErr("firstName","firstNameError","Please enter your first name.");valid=false;}
    if(!lastName||!REGEX_NAME.test(lastName)){showErr("lastName","lastNameError","Please enter your last name.");valid=false;}
    if(!email||!REGEX_EMAIL.test(email)){showErr("email","emailError","Please enter a valid email address.");valid=false;}
    if(!contactMethod){if(cmErr)cmErr.textContent="Please select a preferred contact method.";valid=false;}
    if(contactMethod&&contactMethod.value==="phone"){if(!phone||!REGEX_PHONE.test(phone)){showErr("phone","phoneError","A valid phone number is required when phone contact is selected.");valid=false;}}
    if(!county||!REGEX_COUNTY.test(county)){showErr("county","countyError","Please enter your county.");valid=false;}
    if(!comments||comments.length<10){showErr("comments","commentsError","Please share your test results (at least 10 characters).");valid=false;}
    if(!valid)return;

    var customer={
      firstName:firstName,lastName:lastName,email:email,
      phone:phone||"Not provided",
      contactMethod:contactMethod.value,
      county:county,
      farmName:document.getElementById("farmName").value.trim()||"Anonymous",
      results:comments,
      submittedAt:new Date().toLocaleString("en-US"),
    };

    submitForm.style.display="none";
    formSuccess.classList.add("visible");
    formSuccess.innerHTML='<h3>Thank you, '+customer.firstName+'.</h3><p>Your results for <strong>'+customer.county+'</strong> are in. We\'ll review them within 48 hours and add <strong>'+customer.farmName+'</strong> to the map. We\'ll be in touch via <strong>'+customer.contactMethod+'</strong>.</p><div class="success-data">Name: '+customer.firstName+' '+customer.lastName+'<br/>Email: '+customer.email+'<br/>Phone: '+customer.phone+'<br/>Contact via: '+customer.contactMethod+'<br/>County: '+customer.county+'<br/>Farm / Family: '+customer.farmName+'<br/>Submitted: '+customer.submittedAt+'<br/><br/>Results: '+customer.results+'</div>';
    submitForm.reset();
  });
}
