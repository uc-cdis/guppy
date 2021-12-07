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
  // const index_flag = key.indexOf("-array-config");
  //         if (index_flag == -1) {
  //           res.send(key);
  try {
    const {
      aliases,
    } = req.body;

    const data = await esInstance.getAllESIndices();
    log.info('[download] ', JSON.stringify(data, null, 4));

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
        res.send(result);
      }
    }
    else {
      console.log("ERROR: Something went wrong in selecting the data guppy/_data_version");
    }
  } catch (err) {
    next(err);
  }
  return 0;
};
