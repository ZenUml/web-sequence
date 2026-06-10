// Participant-type annotation catalog for the ZenUML DSL.
//
// These are the `@Type` prefixes valid in a participant declaration position
// (ParticipantType in the grammar), e.g. `@Actor Alice`, `@Database Orders`.
// The names mirror the icon keys registered in @zenuml/core for this version
// (verified against node_modules/@zenuml/core/dist). They are split into the
// short, everyday "core" set and the long AWS "cloud" set so the autocomplete
// logic in zenumlAutocomplete.ts stays readable.
//
// Each entry is the bare annotation WITH its leading '@', so it can be offered
// as a completion label verbatim.

/** Everyday UML participant types. */
export const CORE_ANNOTATIONS: string[] = [
  '@Actor',
  '@Boundary',
  '@Control',
  '@Entity',
  '@Database',
  '@Queue',
]

/** AWS cloud icon participant types. */
export const CLOUD_ANNOTATIONS: string[] = [
  '@EC2',
  '@ECS',
  '@Lambda',
  '@S3',
  '@EBS',
  '@EFS',
  '@RDS',
  '@DynamoDB',
  '@ElastiCache',
  '@Redshift',
  '@SQS',
  '@SNS',
  '@Kinesis',
  '@VPC',
  '@CloudFront',
  '@CloudWatch',
  '@Cognito',
  '@IAM',
]
