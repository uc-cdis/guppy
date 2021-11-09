import esInstance from './es/index';
import { gitVersion, gitCommit } from './version';

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
    const data = await esInstance.getAllESIndices();

    if (typeof(data) != "undefined" && "statusCode" in data && data["statusCode"] == 200) {
      if ("indices" in data) {
        for (const [key, value] of Object.entries(data["indices"])) {
          const index_flag = key.indexOf("-array-config");
          if (index_flag == -1) {
            res.send(key);
          }
        }
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
