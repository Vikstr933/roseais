import SessionHistory from "../../../components/SessionHistory";

interface SessionsTabProps {
  onSessionDeleted: (sessionId: string) => void;
}

export function SessionsTab({ onSessionDeleted }: SessionsTabProps) {
  return (
    <div className="h-full overflow-hidden">
      <SessionHistory onSessionDeleted={onSessionDeleted} />
    </div>
  );
}

