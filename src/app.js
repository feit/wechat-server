import { send } from 'micro';
import { parse } from 'url';
import { STATUS_CODES } from 'http';
import config from './config';
import agent from './agent';
import tokenManagerFactory from './token-manager-factory';

const { apps, auth } = config;
const tokenManagers = tokenManagerFactory(apps);

export default async (req, res) => {
  Object.assign(req, parse(req.url, true));

  if (!auth(req)) {
    return send(res, 401, STATUS_CODES[401]);
  }

  const appid = req.query && req.query.appid;

  if (!appid || !tokenManagers[appid]) {
    return send(res, 404, `APPID ${STATUS_CODES[404]}`);
  }

  const tokenManager = tokenManagers[appid];

  // proxy wechat api
  if (/cgi-bin/.test(req.pathname)) {
    let result;
    try {
      result = await agent(req, tokenManager);
    } catch (error) {
      return send(res, 400, error);
    }

    return send(res, 200, result);
  }

  // show access_token
  let force = false;
  if (req.pathname === '/refresh') force = true;

  const error = tokenManager.error;
  if (error) {
    return send(res, 400, error);
  }

  if (force) {
    tokenManager.instance.refresh((token) => {
      send(res, 200, token);
    });
    return 1;
  }

  const data = tokenManager.accessToken;
  send(res, 200, data);
};
