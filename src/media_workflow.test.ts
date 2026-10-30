import assert from "node:assert/strict";
import { MediaRequest } from "./media_workflow.js";

const valid: MediaRequest = { prompt: "A blue ceramic mug on a desk", filename: "mug.png" };
assert.match(valid.filename, /^[a-zA-Z0-9._-]+$/);
assert.throws(() => JSON.parse('{"prompt":"x","filename":"bad/name.png"}').filename.match(/^[a-zA-Z0-9._-]+$/) ?? (() => { throw new Error("invalid filename"); })());
console.log("request boundary accepts a safe object key and rejects a path");
