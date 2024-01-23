export const filterConfig = {
  tabs: [{
    title: 'Project',
    fields: [
      'gen3_discovery.primary_site',
    ],
  },
  {
    title: 'Subject',
    fields: [
      'gen3_discovery.primary_site',
    ],
  },
  {
    title: 'File',
    fields: [
      'gen3_discovery.primary_site',
    ],
  }],
};

export const tableConfig = [
  { field: 'gen3_discovery.StudyInstanceUID', name: 'Project' },
];

export const guppyConfig = {
  path: 'http://localhost:6966',
  type: 'metadata',
  fileType: 'file',
  tierAccessLimit: 20,
};

export const fieldMapping = [
  {
    field: 'gen3_discovery.primary_site',
    name: 'Primary Site',
  },
];
