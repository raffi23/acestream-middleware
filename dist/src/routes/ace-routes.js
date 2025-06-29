"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("../lib/axios"));
const aceRouter = (0, express_1.Router)();
const runStream = async (url, req, res) => {
    const { data, headers } = await axios_1.default.get(url, {
        responseType: "stream",
    });
    req.on("close", () => {
        data.destroy();
    });
    res.setHeader("Content-Type", headers["content-type"] || "video/mp4");
    if (headers["content-length"]) {
        res.setHeader("Content-Length", headers["content-length"]);
    }
    data.pipe(res);
};
aceRouter.get("/stream/:id", async (req, res) => {
    const id = req.params.id;
    const consutructUrl = `/getstream?id=${id}`;
    await runStream(consutructUrl, req, res);
});
exports.default = aceRouter;
//# sourceMappingURL=ace-routes.js.map