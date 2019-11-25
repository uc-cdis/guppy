/**
 * Returns an array with arrays of the given size.
 *
 * @param myArray {Array} array to split
 * @param chunkSize {Integer} Size of every group
 */
function chunkArray(myArray, chunkSize) {
  let index = 0;
  const arrayLength = myArray.length;
  const tempArray = [];
  let myChunk;

  for (index = 0; index < arrayLength; index += chunkSize) {
    myChunk = myArray.slice(index, index + chunkSize);
    tempArray.push(myChunk);
  }

  return tempArray;
}

module.exports = {
  chunkArray,
};
