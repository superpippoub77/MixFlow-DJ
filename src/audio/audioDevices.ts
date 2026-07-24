export interface AudioOutputDevice {
  deviceId: string;
  label: string;
}

/**
 * Elenca i dispositivi di uscita audio disponibili (es. cuffie USB, jack,
 * altoparlanti Bluetooth...). Il browser nasconde le etichette finché non è
 * stato concesso un permesso media: in quel caso chiediamo brevemente il
 * microfono solo per sbloccare le etichette (nessun audio viene registrato),
 * poi richiudiamo subito lo stream.
 */
export async function listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  let devices = await navigator.mediaDevices.enumerateDevices();
  let outputs = devices.filter((d) => d.kind === 'audiooutput');

  if (outputs.length > 0 && outputs.every((d) => !d.label)) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
      outputs = devices.filter((d) => d.kind === 'audiooutput');
    } catch {
      // Permesso negato: restituiamo comunque la lista, senza etichette leggibili.
    }
  }

  return outputs.map((d, i) => ({
    deviceId: d.deviceId,
    label: d.label || `Uscita audio ${i + 1}`,
  }));
}
