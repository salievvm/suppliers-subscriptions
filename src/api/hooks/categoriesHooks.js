import RestApi from "../rest/restApi";
import { useSelector, useDispatch } from "react-redux";
import { useGetTokenAuthManager } from "./authHooks";
import { setBindBetweenNameAndCode } from "../../redux/actions/categoriesAction";
import {
    setOpenSnackBar,
    setOpenEditModal,
} from "../../redux/actions/appAction";
import { useGetAppManager, useToggleBackDrop } from "./appHooks";
import {
    setParentChain,
    setBreadcrumbsList,
    setSelectedCategory,
    setParentId,
    setCategoryNameError,
    setCategoryCodeError,
    setCategoryError,
} from "../../redux/actions/categoriesAction";
import {
    addCategory,
    setCategoriesList,
} from "../../redux/actions/categoriesAction";
import {
    STATUS_INTERNAL_ERROR,
    STATUS_BAD_REQUEST,
} from "../../redux/reducers/authReducer";
import { setParentUpdId } from "../../redux/actions/categoriesAction";

export const useGetCategories = () => {
    return useSelector((state) => state.categoriesManager.categoriesList);
};

export const useGetCategoryManager = () => {
    return useSelector((state) => state.categoriesManager);
};

export const useCrudCategory = () => {
    const dispatch = useDispatch();
    const errors = useCloseErrors();
    const categories = useGetCategories();
    const restService = useRestApiInit();
    const manager = useGetCategoryManager();

    const add = async (name, code) => {
        const result = await restService.addCategory(
            name,
            code,
            manager.parentId
        );
        errors.close();
        if (typeof result === "number") {
            dispatch(
                addCategory({
                    id: result,
                    name,
                    code,
                    parentId: manager.parentId,
                    countChildrens: 0
                })
            );
            dispatch(setOpenEditModal(false));
        } else {
            const messageError = result.data.message;
            switch (result.status) {
                case STATUS_BAD_REQUEST:
                    if (Array.isArray(messageError)) {
                        dispatch(
                            setCategoryNameError(
                                messageError[0].replace("name", "Поле название")
                            )
                        );
                        dispatch(
                            setCategoryCodeError(
                                messageError[1].replace("code", "Поле код")
                            )
                        );
                    } else {
                        dispatch(setOpenSnackBar(true));
                        dispatch(setCategoryError(messageError));
                    }
                    break;
                case STATUS_INTERNAL_ERROR:
                    dispatch(setCategoryError(messageError));
                    break;
                default:
                    return true;
            }
        }
    };

    const update = async (id, name, code, parentId = null) => {
        const categoriesList = [];
        categories.forEach((category) => {
            const newCat = category;
            if (category.id === id) {
                newCat.name = name;
                newCat.code = code;
            }
            categoriesList.push(newCat);
        });

        errors.close();
        if (name.length > 0 && code.length > 0) {
            if(parentId === null) {
                parentId = manager.parentId;
            }
            const result = await restService.updateCategory(
                id,
                name,
                code,
                parentId
            );
            if (result === true) {
                dispatch(setCategoriesList(categoriesList));
                dispatch(setOpenEditModal(false));
            } else {
                switch (result.status) {
                    case STATUS_BAD_REQUEST:
                        dispatch(setCategoryError(result.data.message));
                        dispatch(setOpenSnackBar(true));
                        break;
                    case STATUS_INTERNAL_ERROR:
                        dispatch(setCategoryError(result.data.message));
                        dispatch(setOpenSnackBar(true));
                        break;
                    default:
                        return true;
                }
            }
        } else {
            dispatch(setCategoryError("Заполните все поля перед сохранением!"));
            dispatch(setOpenSnackBar(true));
        }
    };

    const remove = async (id) => {
        const categoriesList = [];
        categories.forEach((category) => {
            if (category.id !== id) {
                categoriesList.push(category);
            }
        });
        dispatch(setCategoriesList(categoriesList));
        const result = await restService.deleteCategory(id);
        if (result.data === false) {
            dispatch(setCategoryError("Данной категории не существует!"));
            dispatch(setOpenSnackBar(true));
        }
    };

    return {
        categories,
        add,
        update,
        remove,
    };
};

export const useCrudManager = () => {
    const appManager = useGetAppManager();
    const manager = useGetCategoryManager();
    const crud = useCrudCategory();
    const restService = new RestApi();
    const dispatch = new useDispatch();

    const manage = (name, code) => {
        if (appManager.isEditModal) {
            const id = manager.categoryId;
            crud.update(id, name, code, manager.parentUpdId);
            restService.getCategoryByField('parentId', manager.parentId).then((res)=> {
                dispatch(setCategoriesList(res.data));
            });
        } else {
            crud.add(name, code);
        }
    };

    return { manager, isUpd: appManager.isEditModal, manage };
};

export const useGetCategoryByField = () => {
    const restService = useRestApiInit();
    const manager = useGetCategoryManager();
    const dispatch = useDispatch();
    const backDrop = useToggleBackDrop();

    const get = async (field, id, setSelected = true, setChain = false, countChildrensCat = false) => {
        backDrop.toggle(true);
        let result = {};
        if(countChildrensCat) {
            result = await restService.getCategoryWithCountChildrensByField(field, id);
        } else {
            result = await restService.getCategoryByField(field, id);
        }
        if (result.status === 200) {
            if (setSelected) {
                dispatch(setParentUpdId(result.data.parentId));
                dispatch(setSelectedCategory(result.data));
            } else {
                field === "parentId" && dispatch(setParentId(id));
                setChain === true && dispatch(setParentChain(id));
                dispatch(setCategoriesList(result.data));
            }
            backDrop.toggle(false);
            return true;
        }

        backDrop.toggle(false);
        return false;
    };

    return { state: manager.selectedCategory, get };
};

export const useBackByChainCategory = () => {
    const manager = useGetCategoryManager();
    const restService = useRestApiInit();
    const dispatch = useDispatch();
    const backDrop = useToggleBackDrop();
    const checkCatExist = useCheckCategoryExist();

    const goBack = async () => {
        let breadcrumbs = manager.breadcrumbs.map((breadcrumb) => breadcrumb);
        let check = false;

        if (breadcrumbs.length > 1) {
            let categoryId = 0;
            backDrop.toggle(true);
            breadcrumbs.pop();
            categoryId = breadcrumbs[breadcrumbs.length - 1].id;
            await checkCatExist.check(categoryId).then((result) => {
                check = result;
            });

            if(!check) {
                breadcrumbs.pop();
                categoryId = breadcrumbs[breadcrumbs.length - 1].id;
            }
            
            const result = await restService.getCategoryWithCountChildrensByField(
                "parentId",
                categoryId
            );
            dispatch(setBreadcrumbsList(breadcrumbs));
            dispatch(setCategoriesList(result.data));
            dispatch(setParentId(categoryId));
            backDrop.toggle(false);
        }
    };

    return { goBack };
};

export const useCheckCategoryExist = () => {
    const restService = useRestApiInit();
    const manager = useGetCategoryManager();
    const parentsList = manager.breadcrumbs.map((breadcrumb) => breadcrumb.id);
    const dispatch = useDispatch();

    const check = async (id) => {
        if (id > 0) {
            const result = await restService.getCategoryByField("id", id);
            let parentId = 0;
            if (result.status === 200) {
                if (result.data.length <= 0) {
                    if (parentsList.length > 0) {
                        parentId = parentsList[parentsList.length - 1];
                    }

                    const categories = await restService.getCategoryByField(
                        "parentId",
                        parentId
                    );
                    if (categories.status === 200) {
                        dispatch(setCategoriesList(categories.data));
                    }

                    dispatch(setOpenSnackBar(true));
                    dispatch(
                        setCategoryError(
                            "Выбранной категории больше не существует в базе!"
                        )
                    );

                    return false;
                }
            }
        }

        return true;
    };

    return { check };
};

export const useSetBindBetweenNameAndCode = () => {
    const dispatch = useDispatch();
    const set = (isBind = true) => {
        dispatch(setBindBetweenNameAndCode(isBind))
    }
    
    return {set, useGetCategoryManager};
}

export const useRestApiInit = () => {
    const token = useGetTokenAuthManager();
    const restService = new RestApi(token);
    return restService;
};

export const useCloseErrors = () => {
    const dispatch = useDispatch();
    const close = () => {
        dispatch(setOpenSnackBar(false));
        dispatch(setCategoryNameError(""));
        dispatch(setCategoryCodeError(""));
        dispatch(setCategoryError(""));
    };

    return { close };
};
