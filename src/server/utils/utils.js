export const firstLetterUpperCase = str => str.charAt(0).toUpperCase() + str.slice(1);

export const test = 1;

/**
 * transfer '/programs/DEV/projects/test' to 'DEV-test'
 */
export const transferSlashStyleToDashStyle = (str) => {
  const reg = /^\/programs\/(.*)\/projects\/(.*)$/;
  const matchResult = str.match(reg);
  if (!matchResult) return null;
  if (matchResult.length !== 3 || matchResult[0] !== str) return null;
  const programName = matchResult[1];
  const projectName = matchResult[2];
  return `${programName}-${projectName}`;
};

export const addTwoFilters = (filter1, filter2) => {
  if (!filter1 && !filter2) return {};
  if (!filter1) return filter2;
  if (!filter2) return filter1;
  const appliedFilter = {
    AND: [
      filter1,
      filter2,
    ],
  };
  return appliedFilter;
};
