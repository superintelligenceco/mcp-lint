import fc from "fast-check";

// FC_NUM_RUNS raises the number of property-based runs, for example in the nightly workflow.
const numRuns = Number(process.env.FC_NUM_RUNS);
if (Number.isInteger(numRuns) && numRuns > 0) fc.configureGlobal({ numRuns });
