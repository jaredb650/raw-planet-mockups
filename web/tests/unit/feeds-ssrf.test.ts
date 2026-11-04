import { describe, expect, it } from "vitest";
import { isPrivateIp } from "@/lib/feeds";

describe("isPrivateIp", () => {
  it("blocks loopback, private, link-local and metadata addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
      expect(isPrivateIp(ip), ip).toBe(true);
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "142.250.80.46", "2607:f8b0:4004:800::200e"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});
