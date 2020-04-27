
import esInstance from './es/index';


const statusRouter = async (req, res, next) => {
  try {
    const data = await esInstance.getAllESIndices();
    res.send(data);
  } catch (err) {
    next(err);
  }
  return 0;
};

export default statusRouter;
