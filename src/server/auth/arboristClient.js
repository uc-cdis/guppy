import fetch from 'node-fetch';
import config from '../config';
import log from '../logger';
import CodedError from '../utils/error';
import http from 'node:http';
import https from 'node:https';

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const agent = (_parsedURL) => _parsedURL.protocol == 'http:' ? httpAgent : httpsAgent;


class ArboristClient {
  constructor(arboristEndpoint) {
    this.baseEndpoint = arboristEndpoint;
  }

  listAuthMapping(jwt) {
    // Make request to arborist for list of resources with access
    const resourcesEndpoint = `${this.baseEndpoint}/auth/mapping`;
    log.debug('[ArboristClient] listAuthMapping jwt: ', jwt);

    const headers = (jwt) ? { Authorization: `bearer ${jwt}` } : {};
    return fetch(
      resourcesEndpoint,
      {
        method: 'POST',
        headers: headers,
        timeout: 0,
        agent: new http.Agent({
          keepAlive: true,
          keepAliveMsecs: 10000,
        }),
        // agent: function (_parsedURL) {
        //     if (_parsedURL.protocol == 'http:') {
        //         return httpAgent;
        //     } else {
        //         return httpsAgent;
        //     }
        // }
      },
    )
    .then(
      (response) => {
        if (response.status === 400) {
          // Retry with GET instead of POST. Older version of Arborist POST auth/mapping
          // didn't support token authentication.
          // This catch block can be removed in a little while, when it will likely not cause issues
          return fetch(
            resourcesEndpoint,
            {
              method: 'GET',
              headers,
            },
          ).then((res) => res.json());
        }
        return response.json();
      },
      (err) => {
        log.error(err);
        throw new CodedError(500, err);
      },
    );
  }

  checkResourceAuth(jwt, resources, methods, service){
    // Make request to arborist for list of resources with access
    if (typeof(resources) === "string") {
      resources = [resources];
    }
    if (typeof(methods) === "string") {
      methods = [methods];
    }

    var data = {}
    data["requests"] = []
    for (var i=0; i<methods.length; i++) {
      for (var j=0; j<resources.length; j++){
        var tmp = {"resource": resources[j], "action": {"service": service, "method": methods[i]}};
        data["requests"].push(tmp);
      }
    }

    data["user"] = {"token": jwt}


    const resourcesEndpoint = `${this.baseEndpoint}/auth/request`;
    log.debug('[ArboristClient] checkResourceAuth jwt: ', jwt);
    const headers = (jwt) ? { Authorization: `bearer ${jwt}` } : {};

    return fetch(
      resourcesEndpoint,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
      },
    ).then(
      (response) => {
        return response.json();
      },
    ).then((response) => {
      return response["auth"];
    },
    (err) => {
      log.error(err);
      throw new CodedError(500, err);
    });
  }

}

export default new ArboristClient(config.arboristEndpoint);
