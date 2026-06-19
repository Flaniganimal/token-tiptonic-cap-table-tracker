// verify.js
// Automated verification script to test calculations and dilution mechanics in Node.js

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

// 1. Core Merger Math Implementation
function calculateProforma(inputs, tokenCap, tiptonicCap, vestingState) {
  const tokenEquity = Math.max(0, inputs.tokenPreMergerValue - inputs.tokenWorkingCapitalDebt);
  const tiptonicEquity = inputs.tiptonicPreMergerValue;
  const postMoney = tokenEquity + tiptonicEquity + inputs.cashInvestment;
  
  const tokenShare = postMoney > 0 ? tokenEquity / postMoney : 0;
  const tiptonicSlice = postMoney > 0 ? tiptonicEquity / postMoney : 0;
  const newmoneySlice = postMoney > 0 ? inputs.cashInvestment / postMoney : 0;

  const rows = [];
  let totalPct = 0;

  // Token Side
  tokenCap.forEach(holder => {
    const pfPct = (holder.percentage / 100) * tokenShare * 100;
    rows.push({ name: holder.name, percentage: pfPct, source: 'token' });
    totalPct += pfPct;
  });

  // Tiptonic Earn-in: Ben and Jay
  const benHolder = tiptonicCap.find(h => h.name.toLowerCase() === 'ben') || { percentage: 10.0 };
  const jayHolder = tiptonicCap.find(h => h.name.toLowerCase() === 'jay') || { percentage: 10.0 };

  let benProforma = 0;
  let jayProforma = 0;

  if (vestingState === 'close') {
    benProforma = (benHolder.percentage / 100) * tiptonicSlice * 100;
    jayProforma = (jayHolder.percentage / 100) * tiptonicSlice * 100;
  } else {
    // Fully Vested: 40% of Tiptonic slice each
    benProforma = 0.40 * tiptonicSlice * 100;
    jayProforma = 0.40 * tiptonicSlice * 100;
  }

  rows.push({ name: 'Ben', percentage: benProforma, source: 'tiptonic-earn-in' });
  rows.push({ name: 'Jay', percentage: jayProforma, source: 'tiptonic-earn-in' });
  totalPct += benProforma + jayProforma;

  // Residual Tiptonic
  let residualTiptonic = 0;
  if (vestingState === 'close') {
    residualTiptonic = (tiptonicSlice - (benProforma / 100) - (jayProforma / 100)) * 100;
  } else {
    residualTiptonic = (tiptonicSlice - (benProforma / 100) - (jayProforma / 100)) * 100;
  }
  rows.push({ name: 'Christina & Jack + Other', percentage: residualTiptonic, source: 'tiptonic-residual' });
  totalPct += residualTiptonic;

  // Cash Investment
  const cashPct = newmoneySlice * 100;
  rows.push({ name: 'Jack & Christina (Cash)', percentage: cashPct, source: 'new-money' });
  totalPct += cashPct;

  return {
    postMoney,
    rows,
    totalPct
  };
}

// Dilution Scaling Helper
function addShareholder(table, name, percentage, source) {
  const newTable = JSON.parse(JSON.stringify(table));
  if (source === 'prorata') {
    const scaleFactor = (100 - percentage) / 100;
    newTable.forEach(h => {
      h.percentage = h.percentage * scaleFactor;
    });
  } else {
    const sourceHolder = newTable.find(h => h.id === source);
    if (!sourceHolder || sourceHolder.percentage < percentage) {
      throw new Error("Insufficient percentage for specific dilution.");
    }
    sourceHolder.percentage -= percentage;
  }
  newTable.push({ id: 'new_' + Date.now(), name, percentage });
  return newTable;
}

// Define Default State
const defaultInputs = {
  tokenPreMergerValue: 4860000,
  tiptonicPreMergerValue: 290000,
  cashInvestment: 500000,
  tokenWorkingCapitalDebt: 30000
};

const defaultTokenCap = [
  { id: 't1', name: 'Daniel & Nadia', percentage: 80.0 },
  { id: 't2', name: 'Joseph McDonough', percentage: 20.0 }
];

const defaultTiptonicCap = [
  { id: 'tp1', name: 'Ben', percentage: 10.0 },
  { id: 'tp2', name: 'Jay', percentage: 10.0 },
  { id: 'tp3', name: 'Christina & Jack', percentage: 65.0 },
  { id: 'tp4', name: 'Other', percentage: 15.0 }
];

console.log("🚀 Starting Automated Acceptance Checks...");

// Test Case 1: Post-Merger Value
const resClose = calculateProforma(defaultInputs, defaultTokenCap, defaultTiptonicCap, 'close');
console.log(`- Calculated Post-Money Value: $${resClose.postMoney.toLocaleString()}`);
assert(resClose.postMoney === 5620000, "Post-Merger Value must equal $5,620,000");
console.log("✅ Post-Merger Value: PASS");

// Test Case 2: Pro Forma Splits At Close
const danielClose = resClose.rows.find(r => r.name === 'Daniel & Nadia').percentage;
const josephClose = resClose.rows.find(r => r.name === 'Joseph McDonough').percentage;
const benClose = resClose.rows.find(r => r.name === 'Ben').percentage;
const jayClose = resClose.rows.find(r => r.name === 'Jay').percentage;

console.log(`- At Close: Daniel & Nadia = ${danielClose.toFixed(2)}% (Target ≈ 68.8%)`);
console.log(`- At Close: Joseph McDonough = ${josephClose.toFixed(2)}% (Target ≈ 17.2%)`);
console.log(`- At Close: Ben = ${benClose.toFixed(2)}% (Target ≈ 0.5%)`);
console.log(`- At Close: Jay = ${jayClose.toFixed(2)}% (Target ≈ 0.5%)`);

assert(Math.abs(danielClose - 68.754) < 0.1, "Daniel & Nadia must be ≈ 68.8% At Close");
assert(Math.abs(josephClose - 17.188) < 0.1, "Joseph McDonough must be ≈ 17.2% At Close");
assert(Math.abs(benClose - 0.516) < 0.1, "Ben must be ≈ 0.5% At Close");
assert(Math.abs(jayClose - 0.516) < 0.1, "Jay must be ≈ 0.5% At Close");
assert(Math.abs(resClose.totalPct - 100.0) < 0.0001, "Pro forma At Close total must equal 100.0%");
console.log("✅ At Close Splits and Totals: PASS");

// Test Case 3: Pro Forma Splits Fully Vested
const resVested = calculateProforma(defaultInputs, defaultTokenCap, defaultTiptonicCap, 'vested');
const benVested = resVested.rows.find(r => r.name === 'Ben').percentage;
const jayVested = resVested.rows.find(r => r.name === 'Jay').percentage;

console.log(`- Fully Vested: Ben = ${benVested.toFixed(2)}% (Target ≈ 2.1%)`);
console.log(`- Fully Vested: Jay = ${jayVested.toFixed(2)}% (Target ≈ 2.1%)`);

assert(Math.abs(benVested - 2.064) < 0.1, "Ben must be ≈ 2.1% when Fully Vested");
assert(Math.abs(jayVested - 2.064) < 0.1, "Jay must be ≈ 2.1% when Fully Vested");
assert(Math.abs(resVested.totalPct - 100.0) < 0.0001, "Pro forma Fully Vested total must equal 100.0%");
console.log("✅ Fully Vested Splits and Totals: PASS");

// Test Case 4: Dilution scaling pro-rata
console.log("- Testing Pro-Rata dilution...");
const proRataToken = addShareholder(defaultTokenCap, "Alice", 10.0, 'prorata');
const sumProRata = proRataToken.reduce((acc, h) => acc + h.percentage, 0);
assert(Math.abs(sumProRata - 100.0) < 0.0001, "Pro-rata addition total must remain 100.0%");
assert(proRataToken.find(h => h.name === 'Daniel & Nadia').percentage === 72.0, "Daniel & Nadia should dilute from 80% to 72% (80 * 0.9)");
assert(proRataToken.find(h => h.name === 'Joseph McDonough').percentage === 18.0, "Joseph McDonough should dilute from 20% to 18% (20 * 0.9)");
console.log("✅ Dilution Pro-Rata: PASS");

// Test Case 5: Dilution scaling specific holder
console.log("- Testing Specific Shareholder dilution...");
const specificToken = addShareholder(defaultTokenCap, "Alice", 10.0, 't1');
const sumSpecific = specificToken.reduce((acc, h) => acc + h.percentage, 0);
assert(Math.abs(sumSpecific - 100.0) < 0.0001, "Specific source addition total must remain 100.0%");
assert(specificToken.find(h => h.name === 'Daniel & Nadia').percentage === 70.0, "Daniel & Nadia should dilute from 80% to 70%");
assert(specificToken.find(h => h.name === 'Joseph McDonough').percentage === 20.0, "Joseph McDonough should be unchanged at 20%");
console.log("✅ Dilution Specific Source: PASS");

// Deletion Scaling Helper
function deleteShareholderTest(table, id) {
  const newTable = JSON.parse(JSON.stringify(table));
  const index = newTable.findIndex(h => h.id === id);
  if (index !== -1) {
    newTable.splice(index, 1);
    if (newTable.length > 0) {
      const sumRemaining = newTable.reduce((acc, h) => acc + h.percentage, 0);
      if (sumRemaining > 0) {
        const scaleFactor = 100.0 / sumRemaining;
        newTable.forEach(h => {
          h.percentage = h.percentage * scaleFactor;
        });
      }
    }
  }
  return newTable;
}

// Test Case 6: Deletion scaling pro-rata
console.log("- Testing Deletion scaling pro-rata...");
const dilatedToken = addShareholder(defaultTokenCap, "Alice", 20.0, 'prorata');
const restoredToken = deleteShareholderTest(dilatedToken, dilatedToken.find(h => h.name === "Alice").id);
const sumRestored = restoredToken.reduce((acc, h) => acc + h.percentage, 0);
assert(Math.abs(sumRestored - 100.0) < 0.0001, "Restored table total must sum to 100.0%");
assert(restoredToken.find(h => h.name === 'Daniel & Nadia').percentage === 80.0, "Daniel & Nadia should return to 80.0%");
assert(restoredToken.find(h => h.name === 'Joseph McDonough').percentage === 20.0, "Joseph McDonough should return to 20.0%");
console.log("✅ Deletion scaling: PASS");

console.log("\n🎉 ALL ACCEPTANCE CHECKS PASSED SUCCESSFULLY!");
