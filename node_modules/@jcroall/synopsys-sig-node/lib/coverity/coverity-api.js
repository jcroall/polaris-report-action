"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanUrl = exports.CoverityApiService = exports.KEY_LAST_SNAPSHOT_ID = exports.KEY_FIRST_SNAPSHOT_ID = exports.KEY_CLASSIFICATION = exports.KEY_ACTION = exports.KEY_MERGE_KEY = exports.KEY_CID = void 0;
var core_1 = require("@actions/core");
var Handlers_1 = require("typed-rest-client/Handlers");
var RestClient_1 = require("typed-rest-client/RestClient");
exports.KEY_CID = 'cid';
exports.KEY_MERGE_KEY = 'mergeKey';
exports.KEY_ACTION = 'action';
exports.KEY_CLASSIFICATION = 'classification';
exports.KEY_FIRST_SNAPSHOT_ID = 'firstSnapshotId';
exports.KEY_LAST_SNAPSHOT_ID = 'lastDetectedId';
var CoverityApiService = /** @class */ (function () {
    function CoverityApiService(coverityUrl, coverityUsername, coverityPassword, client_name) {
        if (client_name === void 0) { client_name = "Generic Coverity REST API Client"; }
        this.coverityUrl = cleanUrl(coverityUrl);
        var authHandler = new Handlers_1.BasicCredentialHandler(coverityUsername, coverityPassword, true);
        this.restClient = new RestClient_1.RestClient(client_name, this.coverityUrl, [authHandler], {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
    }
    CoverityApiService.prototype.findIssues = function (projectName, offset, limit) {
        return __awaiter(this, void 0, void 0, function () {
            var requestBody, queryParameters, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        requestBody = {
                            filters: [
                                {
                                    columnKey: 'project',
                                    matchMode: 'oneOrMoreMatch',
                                    matchers: [
                                        {
                                            class: 'Project',
                                            name: projectName,
                                            type: 'nameMatcher'
                                        }
                                    ]
                                }
                            ],
                            columns: [exports.KEY_CID, exports.KEY_MERGE_KEY, exports.KEY_ACTION, exports.KEY_CLASSIFICATION, exports.KEY_FIRST_SNAPSHOT_ID, exports.KEY_LAST_SNAPSHOT_ID]
                        };
                        queryParameters = {
                            params: {
                                locale: 'en_us',
                                offset: offset,
                                rowCount: limit,
                                includeColumnLabels: 'true',
                                queryType: 'bySnapshot',
                                sortOrder: 'asc'
                            }
                        };
                        return [4 /*yield*/, this.restClient.create('/api/v2/issues/search', requestBody, { queryParameters: queryParameters })];
                    case 1:
                        response = _a.sent();
                        if (response.statusCode < 200 || response.statusCode >= 300) {
                            (0, core_1.debug)("Coverity response error: ".concat(response.result));
                            return [2 /*return*/, Promise.reject("Failed to retrieve issues from Coverity for project '".concat(projectName, "': ").concat(response.statusCode))];
                        }
                        return [2 /*return*/, Promise.resolve(response.result)];
                }
            });
        });
    };
    return CoverityApiService;
}());
exports.CoverityApiService = CoverityApiService;
function cleanUrl(url) {
    if (url && url.endsWith('/')) {
        return url.slice(0, url.length - 1);
    }
    return url;
}
exports.cleanUrl = cleanUrl;
