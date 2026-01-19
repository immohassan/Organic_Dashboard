import './globals.css';

export const metadata = {
  title: 'Organic Video Performance Dashboard',
  description: 'Track organic video views by editor'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
