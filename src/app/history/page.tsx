import { redirect } from "next/navigation";

// Classes are now browsed by folder on the home page; keep this route
// alive so old links and bookmarks land somewhere useful.
export default function HistoryIndexRedirect() {
  redirect("/");
}
