const Thing = require('core-util-is');
const Utils = require('@iamjoeker/swaggerize-routes/lib/utils');
const Authorize = require('./middlewares/authorize');
const MakeValidator = require('./middlewares/validator');
const PathRegexp = require('path-to-regexp');

/**
 * Wraps try catch block around async function
 * Errors are sent to next handler automatically
 *
 * @param fn
 * @return {Function}
 */
function asyncMiddleware(fn) {
    return function (req, res, next) {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Builds a complete path for route usage from the mountpath and the path
 * @param mountpath
 * @param path
 * @return complete route path
 */
function buildRoutePath(mountpath, path) {
    return mountpath + Utils.prefix(path.replace(/{([^}]+)}/g, ':$1'), '/');
}

/**
 * Creates a new Express route and adds it to the router.
 * @param router
 * @param mountpath
 * @param routeSpec
 */
function makeExpressRoute(router, mountpath, route, securityDefinitions) {
    let path;
    let args;
    let before;
    let validators, handlers;

    path = buildRoutePath(mountpath, route.path);
    args = [path];
    before = [];
    handlers = [];

    if (route.security) {
        before.push(Authorize(route.security, securityDefinitions));
    }

    if (Thing.isArray(route.handler)) {
        if (route.handler.length > 1) {
            Array.prototype.push.apply(before, route.handler.slice(0, route.handler.length - 1));
        }

        route.handler = [].concat(route.handler[route.handler.length - 1]);
    } else {
        route.handler = [route.handler];
    }

    for (let i = 0; i < route.handler.length; ++i) {
        if (route.handler[i].constructor.name === 'AsyncFunction') {
            handlers.push(asyncMiddleware(route.handler[i]));
        } else {
            handlers.push(route.handler[i]);
        }
    }

    validators = [];

    if (route.validators) {
        for (let i = 0; i < route.validators.length; ++i) {
            validators.push(MakeValidator(route.validators[i], route.consumes));
        }
    }

    before = before.concat(validators);

    Array.prototype.push.apply(args, before);
    Array.prototype.push.apply(args, handlers);
    router[route.method].apply(router, args);
}

/**
 * Builds the middleware to manage not allowed calls that use wrong Method
 * @param methods - list of avalaible method for this request
 * @return {function}
 */
const buildNotAllowedMiddleware = methods => (req, res, next) => {
    if (methods.indexOf(req.method.toLowerCase()) === -1) {
        res.set('Allow', methods.join(', ').toUpperCase());
        res.sendStatus(405).end();
    }
    next();
};

/**
 * Routes handlers to express router.
 * @param router
 * @param options
 */
function expressRoutes(router, options) {
    let routes;
    let mountpath;
    let routePath;
    let routesMethod = {};

    routes = options.routes || [];
    options.docspath = Utils.prefix(options.docspath || '/api-docs', '/');
    options.api.basePath = Utils.prefix(options.api.basePath || '/', '/');
    mountpath = Utils.unSuffix(options.api.basePath, '/');
    //Add the api document route
    router.get(mountpath + options.docspath, (req, res) => res.json(options.api));
    //Iterate over routes (paths)
    routes.forEach(function (route) {
        makeExpressRoute(router, mountpath, route, options.api.securityDefinitions);
        routePath = buildRoutePath(mountpath, route.path);
        routesMethod[routePath] = routesMethod[routePath] || [];
        routesMethod[routePath].push(route.method.toLowerCase());
    });

    Object.keys(routesMethod).forEach(routePath => router.use(PathRegexp(routePath), buildNotAllowedMiddleware(routesMethod[routePath])));
}

module.exports = expressRoutes;
