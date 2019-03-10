const histogramQueryStrForEachField = field => (`
  ${field} {
    histogram {
      key
      count
    }
  }`);

export const askGuppyAboutAllFieldsAndOptions = (url, fields) => {
  const queryBody = {
    query: `query {
      aggs {
        ${fields.map(field => histogramQueryStrForEachField(field))}
      }
    }`,
  };
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json());
};

export const getAllFields = (filterTabConfigs) => {
  return filterTabConfigs.reduce((acc, cur) => {
    return acc.concat(cur.filters.map(item => item.field));
  }, []);
};
