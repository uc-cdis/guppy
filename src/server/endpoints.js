import esInstance from './es/index';
import { gitVersion, gitCommit } from './version';
import log from './logger';

export const statusRouter = async (req, res, next) => {
  try {
    const data = await esInstance.getAllESIndices();
    res.send(data);
  } catch (err) {
    next(err);
  }
  return 0;
};

export const versionRouter = async (req, res) => {
  res.send({
    version: gitVersion,
    commit: gitCommit,
  });
  return 0;
};

export const versionData = async (req, res, next) => {
  try {
    // const {
    //   aliases,
    // } = req.body;

    // TODO extend to multiple indexes. Hardcoded to the main one for now. you can get the value from esconfig.indices.[{index}...] and return an array of data version. One for each tab instead of one for all of them.
    const aliases = ["pcdc"]

    const data = await esInstance.getAllESIndices();
    log.info('[_data_version] ', JSON.stringify(data, null, 4));

    var result = {}

    if (typeof(data) != "undefined" && "statusCode" in data && data["statusCode"] == 200) {
      if ("indices" in data) {
        for (const [key, value] of Object.entries(data["indices"])) {
          for (const alias of aliases){
            if ("aliases" in value && alias in value["aliases"]){
              if (!(alias in result)) {
                result[alias] = key
              }
              else {
                v_1 = result[alias].split('_')
                v_2 = key.split('_')
                if (v_1.length < 2 || v_2.length < 2) {
                  //error
                  console.log("ERROR: One of the ES index has a wrong name");
                }
                var v_1 = parseInt(v_1[1])
                var v_2 = parseInt(v_2[1])

                if (v_2 > v_1) {
                  result[alias] = key
                } 
              }
            }
          }
        }
        // res.send(result);
        // TODO also hardcoded. to change in the future. This is only to avoid changes in the frontend at the moment.
        res.send(result["pcdc"]);
      }
    }
    // if (typeof(data) != "undefined" && "statusCode" in data && data["statusCode"] == 200) {
    //   if ("indices" in data) {
    //     for (const [key, value] of Object.entries(data["indices"])) {
    //       const index_flag = key.indexOf("-array-config");
    //       if (index_flag == -1) {
    //         res.send(key);
    //       }
    //     }
    //   }
    // }
    else {
      console.log("ERROR: Something went wrong in selecting the data guppy/_data_version");
    }
  } catch (err) {
    next(err);
  }
  return 0;
};
