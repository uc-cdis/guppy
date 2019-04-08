export const filterConfig = {
    tabs: [{
      title: 'Project',
      filters: [
        { field: 'project', label: 'Project' },
        { field: 'study', label: 'Study' },
      ],
    },
    {
      title: 'Subject',
      filters: [
        { field: 'race', label: 'Race' },
        { field: 'ethnicity', label: 'Ethnicity' },
        { field: 'gender', label: 'Gender' },
        { field: 'vital_status', label: 'Vital_status' },
        //{ field: 'whatever_lab_result_value', label: 'Lab Result Value' },
      ],
    },
    {
      title: 'File',
      filters: [
        { field: 'file_count', label: 'File_count' },
        { field: 'file_type', label: 'File_type' },
        { field: 'file_format', label: 'File_format' },
      ],
    }],
  };
  
  export const tableConfig = [
    { field: 'project', name: 'Project' },
    { field: 'study', name: 'Study' },
    { field: 'race', name: 'Race' },
    { field: 'ethnicity', name: 'Ethnicity' },
    { field: 'gender', name: 'Gender' },
    { field: 'vital_status', name: 'Vital Status' },
    { field: 'whatever_lab_result_value', name: 'Lab Result Value' },
    { field: 'file_count', name: 'File Count' },
    { field: 'file_type', name: 'File Type' },
    { field: 'file_format', name: 'File Format' },
  ];

  export const guppyConfig = {
    path: 'http://localhost:3000',
    type: 'subject',
  };
