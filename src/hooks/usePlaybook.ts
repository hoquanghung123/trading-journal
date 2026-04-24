import { useState, useEffect } from "react";
import { PlaybookModel } from "@/types/playbook";
import { fetchPlaybook, upsertSetup, deleteSetup } from "@/lib/playbook";
import { toast } from "sonner";

export function usePlaybook() {
  const [models, setModels] = useState<PlaybookModel[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const reload = async () => {
    try {
      const data = await fetchPlaybook();
      setModels(data);
    } catch (e: any) {
      console.error("Failed to fetch playbook", e);
      toast.error("Failed to load playbook");
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const addModel = async (model: PlaybookModel) => {
    try {
      await upsertSetup(model);
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to add strategy");
    }
  };

  const updateModel = async (updatedModel: PlaybookModel) => {
    try {
      await upsertSetup(updatedModel);
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to update strategy");
    }
  };

  const deleteModel = async (id: string) => {
    try {
      await deleteSetup(id);
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete strategy");
    }
  };

  return {
    models,
    isLoaded,
    addModel,
    updateModel,
    deleteModel,
    reload
  };
}
