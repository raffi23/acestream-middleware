import base from "axios";

const axios = base.create({
  baseURL: "http://acelink:6878/ace",
});

export default axios;
