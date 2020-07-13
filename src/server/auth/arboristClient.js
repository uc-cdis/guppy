import fetch from 'node-fetch';
import config from '../config';
import log from '../logger';
import CodedError from '../utils/error';

class ArboristClient {
  constructor(arboristEndpoint) {
    this.baseEndpoint = arboristEndpoint;
  }

  listAuthorizedResources(jwt) {
    // Make request to arborist for list of resources with access
    const resourcesEndpoint = `${this.baseEndpoint}/auth/mapping`;
    log.debug('[ArboristClient] listAuthorizedResources jwt: ', jwt);
    const headers = (jwt) ? { Authorization: `bearer ${jwt}` } : {};
    return fetch(
      resourcesEndpoint,
      {
        method: 'GET',
        headers,
      },
    ).then(
      (response) => response.json(),
    ).then((result) => {
      const data = {
        resources: [],
      };
      Object.keys(result).forEach((key) => {
        if (result[key] && result[key].some((x) => x.method === 'read')) {
          data.resources.push(key);
        }
      });
      log.debug('[ArboristClient] data: ', data);
      return data;
    },
    (err) => {
      log.error(err);
      throw new CodedError(500, err);
    });
  }
}

export default new ArboristClient(config.arboristEndpoint);
