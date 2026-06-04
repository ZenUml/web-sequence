import { PreviewCard } from '../components/PreviewCard';

export default {
  title: 'Components/PreviewCard',
  component: PreviewCard,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  tags: ['autodocs'],
  // PreviewCard is a white-surface component: in the real app it lives inside
  // .share-panel (color:#000) on a white modal. It has no background of its own,
  // so on the dark canvas its dark text would be unreadable. This decorator
  // reproduces that white modal context (width/padding mirror .share-panel).
  decorators: [
    (Story) => (
      <div
        style={{
          background: '#fff',
          color: '#000',
          width: '460px',
          padding: '20px',
          borderRadius: '8px',
          boxSizing: 'border-box',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const Default = {
  args: {
    title: 'User Login Flow',
    author: 'Alice Johnson',
    description: 'Sequence diagram showing the authentication flow between client, server, and database.',
    imageBase64: undefined,
  },
};

export const WithImage = {
  args: {
    title: 'Order Processing System',
    author: 'Bob Smith',
    description: 'End-to-end order lifecycle from cart submission to fulfillment and notification.',
    imageBase64:
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzFhMWEyZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjM2M2ZmIiBmb250LXNpemU9IjE0Ij5EaWFncmFtIFByZXZpZXc8L3RleHQ+PC9zdmc+',
  },
};

export const LongContent = {
  args: {
    title: 'Microservices Communication — API Gateway to Backend Services with Load Balancing',
    author: 'Carol Nguyen',
    description:
      'This diagram illustrates how the API gateway routes requests to multiple backend microservices, handles retries, and aggregates responses before returning them to the client application.',
    imageBase64: undefined,
  },
};
