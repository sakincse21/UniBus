"use client";

import { useState } from "react";
import { createNotice } from "@/lib/action/notice";
import { useRouter } from "next/navigation";

export default function CreateNoticePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [forAll, setForAll] = useState(false);
  const [forTeachers, setForTeachers] = useState(false);
  const [targetBatchId, setTargetBatchId] = useState("");

  const submit = async () => {
    const res = await createNotice({
      title,
      content,
      forAll,
      forTeachers,
      targetBatchId: targetBatchId ? Number(targetBatchId) : undefined,
    });

    if (res.success) {
      router.push("/notice");
    } else {
      alert(res.message || "Error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-xl font-bold">Create Notice</h1>

      <input
        placeholder="Title"
        className="border p-2"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        placeholder="Content"
        className="border p-2"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <label>
        <input
          type="checkbox"
          checked={forAll}
          onChange={() => setForAll(!forAll)}
        />
        For All
      </label>

      <label>
        <input
          type="checkbox"
          checked={forTeachers}
          onChange={() => setForTeachers(!forTeachers)}
        />
        For Teachers
      </label>

      <input
        placeholder="Target Batch ID"
        className="border p-2"
        value={targetBatchId}
        onChange={(e) => setTargetBatchId(e.target.value)}
      />

      <button
        className="bg-blue-600 text-white p-2 rounded"
        onClick={submit}
      >
        Submit
      </button>
    </div>
  );
}
