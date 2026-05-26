import StoryboardForm from "@/app/components/StoryboardForm";

export default function StoryboardPage() {
  return (
    <main className="min-h-screen bg-[#05070f] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <StoryboardForm />
      </div>
    </main>
  );
}
