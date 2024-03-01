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
    
    // The POST endpoint checks for the presence of a token and validates it if present. 
    // For retrocompatibility if the token is not present will use the clientID or username passed in the body. 
    // We want to avoid using the body values since that could expose 
    // other clients or usernames that are not the logged in user ones.
    const headers = (jwt) ? { Authorization: `bearer ${jwt}` } : {};
    return fetch(
      resourcesEndpoint,
      {
        method: 'POST',
        headers,
      },
    ).then(
      (response) => response.json(),
    ).then(
      (result) => {
        const data = {
          resources: [],
        };
        Object.keys(result).forEach((key) => {
        // logic: you have access to a project if you have the following access:
        // method 'read' (or '*' - all methods) to service 'guppy' (or '*' - all services)
        // on the project resource.
          if (result[key] && result[key].some((x) => (
            (x.method === 'read' || x.method === '*')
          && (x.service === 'guppy' || x.service === '*')
          ))) {
            data.resources.push(key);
          }
        });
        log.debug('[ArboristClient] data: ', data);
        return data;
      },
      (err) => {
        log.error(err);
        throw new CodedError(500, err);
      },
    );
  }
}

export default new ArboristClient(config.arboristEndpoint);
