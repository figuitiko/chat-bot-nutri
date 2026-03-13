export default function Home() {
  return (
    <main>
      <pre>
        {JSON.stringify(
          {
            name: "whatsapp-predefined-bot-backend",
            status: "ok",
            health: "/api/health",
          },
          null,
          2,
        )}
      </pre>
    </main>
  );
}
