import nock from 'nock';
import config from '../config';

const mockSearchEndpoint = (mockRequest, mockResult) => {
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, mockRequest)
    .reply(200, mockResult);
};

export default mockSearchEndpoint;
