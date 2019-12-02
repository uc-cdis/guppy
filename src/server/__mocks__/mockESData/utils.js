import nock from 'nock';
import config from '../config';

const mockSearchEndpoint = (mockRequest, mockResult) => {
  const mockRequestPatched = {
    ...mockRequest,
    highlight: {
      pre_tags: [
        '<em>',
      ],
      post_tags: [
        '</em>',
      ],
      fields: {
        '*.analyzed': {},
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, mockRequestPatched)
    .reply(200, mockResult);
};

export default mockSearchEndpoint;
