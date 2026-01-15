
import { runOrchestratorWithStreamHandler } from "../src/cli/orchestrator/index.js";
import { HumanMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

// Connect to the .env file in the root directory
dotenv.config();

async function runTest() {
    console.log("Starting Orchestrator StreamHandler Test...");
    console.log("Testing new StreamHandler-style display with thinking separation");
    console.log("============================================================\n");

    // A complex query to demonstrate parallel execution and synthesis thinking
    const input = "Compare the key architectural features of the Eiffel Tower and the Tokyo Tower. Also mention their height differences.";

    try {
        const result = await runOrchestratorWithStreamHandler({
            input: input,
            history: [],
            enableThinking: true
        });

        console.log("\n============================================================");
        console.log("Test execution finished successfully.");
        console.log("\nExpected behavior:");
        console.log("✓ Planning phase with optional thinking display");
        console.log("✓ Worker sections with clear thinking (gray) and content (white) separation");
        console.log("✓ Synthesis section with thinking (gray) and final answer (white)");
        console.log("✓ All output uses StreamHandler-style display (no Listr2)");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
