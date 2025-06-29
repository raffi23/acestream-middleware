"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const axios = axios_1.default.create({
    baseURL: "http://127.0.0.1:6878/ace",
});
exports.default = axios;
//# sourceMappingURL=axios.js.map