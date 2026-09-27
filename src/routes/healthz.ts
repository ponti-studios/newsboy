export function loader() {
  return Response.json({ status: "ok" });
}

export default function Healthcheck() {
  return null;
}
