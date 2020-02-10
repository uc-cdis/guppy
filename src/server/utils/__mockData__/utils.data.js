const parsedInfo = {
  name: 'subject',
  alias: 'subject',
  args: {
    accessibility: 'all',
  },
  fieldsByTypeName: {
    Subject: {
      ethnicity: {
        name: 'ethnicity',
        alias: 'ethnicity',
        args: {},
        fieldsByTypeName: {},
      },
      gender: {
        name: 'gender',
        alias: 'gender',
        args: {},
        fieldsByTypeName: {},
      },
      name: {
        name: 'name',
        alias: 'name',
        args: {},
        fieldsByTypeName: {},
      },
      project: {
        name: 'project',
        alias: 'project',
        args: {},
        fieldsByTypeName: {},
      },
      visits: {
        name: 'visits',
        alias: 'visits',
        args: {},
        fieldsByTypeName: {
          visits: {
            follow_ups: {
              name: 'follow_ups',
              alias: 'follow_ups',
              args: {},
              fieldsByTypeName: {
                follow_ups: {
                  days_to_follow_up: {
                    name: 'days_to_follow_up',
                    alias: 'days_to_follow_up',
                    args: {},
                    fieldsByTypeName: {},
                  },
                },
              },
            },
          },
        },
      },
      vital_status: {
        name: 'vital_status',
        alias: 'vital_status',
        args: {},
        fieldsByTypeName: {},
      },
    },
  },
};

const fields = [
  'vital_status',
  'visits.follow_ups.days_to_follow_up',
  'project',
  'name',
  'gender',
  'ethnicity',
];

const UtilsData = {
  parsedInfo,
  fields,
};

export default UtilsData;
