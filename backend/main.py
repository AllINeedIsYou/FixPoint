import json
from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError
from src.api import router


app=FastAPI()
app.include_router(router)


#страховка: значение не влезло в колонку БД (слишком длинное или большое число), это ошибка данных, а не 500
@app.exception_handler(DataError)
async def data_error_handler(request: Request, exc: DataError):
    return JSONResponse(status_code=400, content={"detail": "Некорректные данные: значение не помещается в поле базы данных"})


#ответ 422 повторяет присланные данные (поле input), а битые символы (одиночные суррогаты \ud800)
#и числа вроде 1e309 (inf) в json не кодируются и давали 500. в таком случае отдаем те же ошибки, но без input
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    try:
        return await request_validation_exception_handler(request, exc)
    except (UnicodeEncodeError, ValueError):
        errors = [{key: value for key, value in error.items() if key != "input"} for error in exc.errors()]
        content = json.dumps({"detail": jsonable_encoder(errors)}, ensure_ascii=True)
        return Response(content=content, status_code=422, media_type="application/json")
