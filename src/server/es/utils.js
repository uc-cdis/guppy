import log from '../logger';


const lookup = (obj, k, return_list) => {
  for (var key in obj) {
    var value = obj[key];

    if (k == key) {
      return_list.push(value);
    }

    if (typeof(value) === "object" && !Array.isArray(value)) {
      var y = lookup(value, k, return_list);
    }

    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; ++i) {
        var x = lookup(value[i], k, return_list);
      }
    }
  }

  return return_list;
};


/**
 * This function extracts the nested filter for nested aggregation filter
 * @param {object} graphqlFilterObj - The object built from getFilterObj
 * @param {string} nestedPath - The nested path we want to extract the filter for
 */
const extractNestedFilter = (
  graphqlFilterObj,
  nestedPath
) => {
  var return_list = [];
  var res = lookup(graphqlFilterObj, 'nested', return_list)

  for(let filter of res) {
    if ("path" in filter && filter["path"] == nestedPath) {
      let keys = Object.keys(filter);
      const index = keys.indexOf("path");
      if (index > -1) {
        keys.splice(index, 1);
      }
      if (keys.length == 1) {
        return filter[keys[0]];
      }
      else {
        log.error(`extractNestedFilter - TO BE REVIEWED, NOT SUPPORTED!`);
        log.error(JSON.stringify(graphqlFilterObj));
        return null;
      }
    }
  }
  return {"match_all": {}};
};



export default extractNestedFilter;
